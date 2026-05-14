import pool from '../config/database.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.js';
import { isAIConfigured } from '../services/openrouter.js';

// ──────────────────────────────────────────────────────────────────────────────
// Shared AI call helper (duplicated here to avoid circular imports)
// ──────────────────────────────────────────────────────────────────────────────
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const AI_MODEL = process.env.AI_MODEL || 'anthropic/claude-3-5-sonnet-20241022';

function parseAIJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) {}
  const stripped = text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim();
  try { return JSON.parse(stripped); } catch (_) {}
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch (_) {}
  }
  return null;
}

async function callAI(systemPrompt, userMessage, opts = {}) {
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === 'your_openrouter_api_key_here') return null;
  const MAX_RETRIES = 3;
  const DELAYS = [800, 1600, 3200];
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'AI Appointment Scheduler',
        },
        body: JSON.stringify({
          model: opts.model || AI_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: opts.temperature ?? 0.3,
          max_tokens: opts.maxTokens || 2000,
        }),
      });
      if (!response.ok) {
        const t = await response.text();
        if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, DELAYS[attempt]));
          continue;
        }
        throw new Error(`OpenRouter ${response.status}: ${t}`);
      }
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      return parseAIJson(content);
    } catch (e) {
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, DELAYS[attempt]));
      } else {
        throw e;
      }
    }
  }
  return null;
}

// ============================================
// Smart Follow-Up Generator
// POST /api/ai/followup/:id
// ============================================
export async function generateFollowUp(req, res) {
  const appointmentId = parseInt(req.params.id);
  if (!appointmentId) return res.status(400).json({ error: 'Valid appointment id required' });

  try {
    const aptResult = await pool.query(
      `SELECT a.*, c.name as contact_name, c.email as contact_email
       FROM appointments a LEFT JOIN contacts c ON a.contact_id = c.id
       WHERE a.id = $1 AND a.user_id = $2`,
      [appointmentId, req.user.id]
    );
    if (aptResult.rows.length === 0) return res.status(404).json({ error: 'Appointment not found' });
    const apt = aptResult.rows[0];

    const systemPrompt = `You are a professional meeting follow-up email writer. Generate a concise, friendly follow-up email draft after a completed meeting. Return JSON only.`;
    const userPrompt = `Meeting: ${JSON.stringify({
      title: apt.title,
      description: apt.description,
      start_time: apt.start_time,
      end_time: apt.end_time,
      location: apt.location,
      contact_name: apt.contact_name,
      status: apt.status,
    })}

Return JSON:
{
  "subject": "...",
  "body": "...(email body text)...",
  "key_points": ["..."],
  "next_steps": ["..."],
  "tone": "professional|casual|formal"
}`;

    const aiResult = await callAI(systemPrompt, userPrompt, { temperature: 0.4 });

    const draft = aiResult || {
      subject: `Follow-up: ${apt.title}`,
      body: `Hi ${apt.contact_name || 'there'},\n\nThank you for meeting with me regarding "${apt.title}". I wanted to follow up and ensure we're aligned on next steps.\n\nPlease let me know if you have any questions.\n\nBest regards`,
      key_points: ['Meeting occurred as scheduled'],
      next_steps: ['Review any action items discussed'],
      tone: 'professional',
    };

    const insertResult = await pool.query(
      `INSERT INTO follow_up_drafts (user_id, appointment_id, draft_subject, draft_body, key_points, next_steps, ai_powered)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        req.user.id,
        appointmentId,
        draft.subject,
        draft.body,
        JSON.stringify(draft.key_points || []),
        JSON.stringify(draft.next_steps || []),
        isAIConfigured(),
      ]
    );

    res.json({ draft, saved: insertResult.rows[0], ai_powered: isAIConfigured() });
  } catch (error) {
    console.error('generateFollowUp error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// GET /api/ai/followup — list follow-up drafts with pagination
export async function getFollowUpDrafts(req, res) {
  try {
    const { page, limit, offset } = getPaginationParams(req.query);
    const countResult = await pool.query('SELECT COUNT(*) FROM follow_up_drafts WHERE user_id = $1', [req.user.id]);
    const total = parseInt(countResult.rows[0].count);
    const result = await pool.query(
      `SELECT f.*, a.title as appointment_title, a.start_time
       FROM follow_up_drafts f LEFT JOIN appointments a ON f.appointment_id = a.id
       WHERE f.user_id = $1 ORDER BY f.created_at DESC LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );
    res.json(formatPaginatedResponse(result.rows, total, page, limit));
  } catch (error) {
    console.error('getFollowUpDrafts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// ============================================
// AI Appointment Scoring
// POST /api/ai/score/:id
// ============================================
export async function scoreAppointment(req, res) {
  const appointmentId = parseInt(req.params.id);
  if (!appointmentId) return res.status(400).json({ error: 'Valid appointment id required' });

  try {
    const aptResult = await pool.query(
      `SELECT a.*, c.name as contact_name, c.company as contact_company
       FROM appointments a LEFT JOIN contacts c ON a.contact_id = c.id
       WHERE a.id = $1 AND a.user_id = $2`,
      [appointmentId, req.user.id]
    );
    if (aptResult.rows.length === 0) return res.status(404).json({ error: 'Appointment not found' });
    const apt = aptResult.rows[0];

    // Get contact history to inform score
    const historyResult = apt.contact_id
      ? await pool.query(
          'SELECT COUNT(*) as count, MAX(start_time) as last_meeting FROM appointments WHERE user_id = $1 AND contact_id = $2',
          [req.user.id, apt.contact_id]
        )
      : { rows: [{ count: 0, last_meeting: null }] };

    const systemPrompt = `You are an appointment importance scorer. Rate this appointment 1-10 based on available signals. Return JSON only.`;
    const userPrompt = `Appointment: ${JSON.stringify({
      title: apt.title,
      description: apt.description,
      location: apt.location,
      status: apt.status,
      contact_name: apt.contact_name,
      contact_company: apt.contact_company,
      meeting_count_with_contact: parseInt(historyResult.rows[0].count),
      last_meeting_with_contact: historyResult.rows[0].last_meeting,
    })}

Return JSON:
{
  "score": 1-10,
  "importance_level": "critical|high|medium|low",
  "reasoning": "...",
  "score_factors": [{"factor": "...", "impact": "+|-", "weight": 0-1}]
}`;

    const aiResult = await callAI(systemPrompt, userPrompt, { temperature: 0.2 });

    // Deterministic fallback scoring
    const fallbackScore = apt.contact_id ? (historyResult.rows[0].count > 3 ? 7 : 5) : 4;
    const score = aiResult || {
      score: fallbackScore,
      importance_level: fallbackScore >= 7 ? 'high' : fallbackScore >= 5 ? 'medium' : 'low',
      reasoning: 'Score based on contact relationship history (configure AI for detailed analysis)',
      score_factors: [
        { factor: 'Contact relationship', impact: apt.contact_id ? '+' : '-', weight: 0.5 },
        { factor: 'Meeting frequency', impact: historyResult.rows[0].count > 3 ? '+' : '-', weight: 0.3 },
      ],
    };

    res.json({ appointment_id: appointmentId, scoring: score, ai_powered: isAIConfigured() });
  } catch (error) {
    console.error('scoreAppointment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}
