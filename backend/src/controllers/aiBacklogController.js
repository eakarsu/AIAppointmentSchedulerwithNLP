// Apply pass 5 backlog controller — additive AI endpoints.
//
// Env vars used:
//   - OPENROUTER_API_KEY   (required for AI; missing => HTTP 503)
//
// New endpoints (mounted under /api/ai-extras):
//   POST /cancellation-predict   MECHANICAL — predicts cancellation probability for an appointment
//   POST /satisfaction-score     PRODUCT-DECISION — derives satisfaction from rating + free-text
//   POST /optimal-time-suggest   PRODUCT-DECISION — LLM-only optimal time suggestion (no Maps creds)
//
// PRODUCT-DECISION rationale:
//   * satisfaction-score: source defaults to {rating: 1-5, free-text feedback} captured per
//     appointment. No external survey provider is wired (NEEDS-CREDS).
//   * optimal-time-suggest: travel-time is derived qualitatively by the LLM from a free-text
//     `location_hint` field; a real Maps API integration remains NEEDS-CREDS (Google Maps key).
//
// All endpoints follow the existing aiExtras controller pattern: ensureTables (idempotent),
// JSON parsing 3-strategy fallback inherited from openrouterExtras callAIRaw helper, and
// 503 explicit handling when OPENROUTER_API_KEY is unset.

import pool from '../config/database.js';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const AI_MODEL = process.env.AI_MODEL || 'anthropic/claude-3-5-sonnet-20241022';
const AI_MAX_TOKENS = parseInt(process.env.AI_MAX_TOKENS) || 2000;
const AI_TEMPERATURE = parseFloat(process.env.AI_TEMPERATURE) || 0.3;

function isAIConfigured() {
  return OPENROUTER_API_KEY && OPENROUTER_API_KEY !== 'your_openrouter_api_key_here';
}

function parseAIJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) {}
  const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  try { return JSON.parse(cleaned); } catch (_) {}
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch (_) {}
  }
  return { raw: text };
}

async function callAI(systemPrompt, userMessage, maxTokens = AI_MAX_TOKENS) {
  if (!isAIConfigured()) return null;
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'AI Appointment Scheduler - Backlog',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: AI_TEMPERATURE,
      max_tokens: maxTokens,
    }),
  });
  if (!response.ok) {
    const t = await response.text().catch(() => '');
    throw new Error(`OpenRouter ${response.status}: ${t}`);
  }
  const data = await response.json();
  return parseAIJson(data.choices?.[0]?.message?.content || '');
}

// 503 guard — applied at controller entry rather than route middleware so we can keep
// existing route mounting style consistent with the rest of aiExtras.
function aiKeyMissing(res) {
  return res.status(503).json({
    error: 'AI service not configured',
    detail: 'OPENROUTER_API_KEY environment variable is not set. Configure it to enable AI analysis.',
    missing: 'OPENROUTER_API_KEY',
  });
}

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cancellation_predictions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
      probability NUMERIC(4,3),
      risk_level VARCHAR(20),
      ai_results JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS satisfaction_scores (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
      rating INTEGER,
      feedback_text TEXT,
      score INTEGER,
      sentiment VARCHAR(20),
      ai_results JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS optimal_time_suggestions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255),
      location_hint TEXT,
      ai_results JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// 1) MECHANICAL — Cancellation Prediction
export async function cancellationPredict(req, res) {
  try {
    if (!isAIConfigured()) return aiKeyMissing(res);
    await ensureTables();
    const { appointment_id } = req.body || {};
    if (!appointment_id) return res.status(400).json({ error: 'appointment_id is required' });
    const apt = await pool.query('SELECT * FROM appointments WHERE id = $1 AND user_id = $2', [appointment_id, req.user.id]);
    if (apt.rows.length === 0) return res.status(404).json({ error: 'Appointment not found' });
    // Pull recent appointment history for the same contact, if any
    const contactId = apt.rows[0].contact_id;
    let history = { rows: [] };
    if (contactId) {
      history = await pool.query(
        `SELECT id, title, start_time, status, created_at FROM appointments
         WHERE user_id = $1 AND contact_id = $2 AND id <> $3 ORDER BY start_time DESC LIMIT 20`,
        [req.user.id, contactId, appointment_id]
      );
    }
    const sys = `You estimate the probability that an appointment will be cancelled by either party. Return JSON only.`;
    const user = `Appointment: ${JSON.stringify(apt.rows[0])}
Contact history (most recent 20): ${JSON.stringify(history.rows)}

Return JSON: {
  "probability": 0-1,
  "risk_level": "low|medium|high",
  "top_factors": [{"factor": "...", "weight": 0-1}],
  "mitigations": ["..."],
  "reasoning": "..."
}`;
    const result = await callAI(sys, user, 1500);
    const safe = result && typeof result.probability === 'number'
      ? result
      : { probability: 0.15, risk_level: 'low', top_factors: [], mitigations: [], reasoning: result?.raw || 'no parse' };
    const ins = await pool.query(
      `INSERT INTO cancellation_predictions (user_id, appointment_id, probability, risk_level, ai_results)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, appointment_id, Number(safe.probability).toFixed(3), safe.risk_level || null, JSON.stringify(safe)]
    );
    res.json({ result: safe, saved: ins.rows[0], ai_powered: isAIConfigured() });
  } catch (e) {
    console.error('cancellationPredict error:', e.message);
    res.status(500).json({ error: e.message });
  }
}

// 2) PRODUCT-DECISION — Satisfaction Score
// PRODUCT-DECISION: source = {rating 1-5, free-text feedback} captured post-appointment
// (no external survey vendor wired — that path remains NEEDS-CREDS).
export async function satisfactionScore(req, res) {
  try {
    if (!isAIConfigured()) return aiKeyMissing(res);
    await ensureTables();
    const { appointment_id, rating, feedback_text } = req.body || {};
    const r = Number(rating);
    if (!Number.isFinite(r) || r < 1 || r > 5) {
      return res.status(400).json({ error: 'rating (1-5) is required' });
    }
    const sys = `You score post-appointment satisfaction from a 1-5 rating and optional free-text feedback. Return JSON only.`;
    const user = `Rating (1-5): ${r}
Free-text feedback: ${feedback_text || '(none)'}

Return JSON: {
  "score": 0-100,
  "sentiment": "positive|neutral|negative",
  "key_themes": ["..."],
  "improvement_suggestions": ["..."],
  "follow_up_recommended": true|false
}`;
    const result = await callAI(sys, user, 1200);
    const safe = result && typeof result.score === 'number'
      ? result
      : { score: r * 20, sentiment: r >= 4 ? 'positive' : r >= 3 ? 'neutral' : 'negative', key_themes: [], improvement_suggestions: [], follow_up_recommended: r <= 3 };
    const ins = await pool.query(
      `INSERT INTO satisfaction_scores (user_id, appointment_id, rating, feedback_text, score, sentiment, ai_results)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user.id, appointment_id || null, r, feedback_text || null, Math.round(safe.score), safe.sentiment || null, JSON.stringify(safe)]
    );
    res.json({ result: safe, saved: ins.rows[0], ai_powered: isAIConfigured() });
  } catch (e) {
    console.error('satisfactionScore error:', e.message);
    res.status(500).json({ error: e.message });
  }
}

// 3) PRODUCT-DECISION — Optimal Time Suggestion (LLM-only, no Maps API)
// PRODUCT-DECISION: travel-time is qualitative from a free-text `location_hint` field; a real
// Maps API path remains NEEDS-CREDS (GOOGLE_MAPS_API_KEY).
export async function optimalTimeSuggest(req, res) {
  try {
    if (!isAIConfigured()) return aiKeyMissing(res);
    await ensureTables();
    const { title, duration_minutes, location_hint, attendee_constraints, candidate_window_iso } = req.body || {};
    if (!title) return res.status(400).json({ error: 'title is required' });
    // Pull recent existing appointments for context
    const recent = await pool.query(
      `SELECT id, title, start_time, end_time, location FROM appointments
       WHERE user_id = $1 AND start_time >= NOW() ORDER BY start_time ASC LIMIT 30`,
      [req.user.id]
    );
    const sys = `You suggest optimal meeting times. Travel-time is QUALITATIVE only (no Maps API). Return JSON only.`;
    const user = `New appointment title: ${title}
Duration (min): ${duration_minutes || 60}
Location hint (free text): ${location_hint || '(none)'}
Attendee constraints: ${JSON.stringify(attendee_constraints || {})}
Candidate window iso: ${JSON.stringify(candidate_window_iso || {})}
Existing upcoming appointments (next 30): ${JSON.stringify(recent.rows)}

Return JSON: {
  "ranked_suggestions": [{
    "start_iso": "...",
    "end_iso": "...",
    "score": 0-1,
    "qualitative_travel_minutes": <int>,
    "reasoning": "..."
  }],
  "best_suggestion_iso": "...",
  "warnings": ["..."]
}`;
    const result = await callAI(sys, user, 2000);
    const safe = result && Array.isArray(result.ranked_suggestions)
      ? result
      : { ranked_suggestions: [], best_suggestion_iso: null, warnings: ['parse-failure'] };
    const ins = await pool.query(
      `INSERT INTO optimal_time_suggestions (user_id, title, location_hint, ai_results)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, title, location_hint || null, JSON.stringify(safe)]
    );
    res.json({ result: safe, saved: ins.rows[0], ai_powered: isAIConfigured() });
  } catch (e) {
    console.error('optimalTimeSuggest error:', e.message);
    res.status(500).json({ error: e.message });
  }
}
