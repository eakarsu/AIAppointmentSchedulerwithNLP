// Extra AI services for new audit-proposed features.
// Reuses callAI helper signature from openrouter.js by re-exporting wrappers.
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../../.env') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const AI_MODEL = process.env.AI_MODEL || 'anthropic/claude-3-5-sonnet-20241022';
const AI_TEMPERATURE = parseFloat(process.env.AI_TEMPERATURE) || 0.3;
const AI_MAX_TOKENS = parseInt(process.env.AI_MAX_TOKENS) || 4000;

function isAIConfigured() {
  return OPENROUTER_API_KEY && OPENROUTER_API_KEY !== 'your_openrouter_api_key_here';
}

// 3-strategy JSON parser (matches AP/AR-style parseAIJson)
function parseAIJson(text) {
  if (!text) return null;
  // 1) Try direct parse
  try {
    return JSON.parse(text);
  } catch (_) {}
  // 2) Strip markdown fences and retry
  const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (_) {}
  // 3) Extract first JSON-looking block
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (_) {}
  }
  return { raw: text };
}

async function callAIRaw(systemPrompt, userMessage, opts = {}) {
  if (!isAIConfigured()) return null;
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
          temperature: opts.temperature ?? AI_TEMPERATURE,
          max_tokens: opts.maxTokens || AI_MAX_TOKENS,
        }),
      });
      if (!response.ok) {
        const t = await response.text();
        const retry = response.status === 429 || response.status >= 500;
        if (retry && attempt < MAX_RETRIES - 1) {
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

// 1. Time-zone Smart Rescheduling
export async function smartTimezoneReschedule({ appointment, fromTimezone, toTimezone, workHours }) {
  const sys = `You are a scheduling expert specialised in cross-timezone optimisation. Return JSON only.`;
  const user = `Appointment: ${JSON.stringify(appointment)}
Original timezone: ${fromTimezone}
Target timezone: ${toTimezone}
Local working hours in target tz: ${JSON.stringify(workHours || { start: '09:00', end: '18:00' })}

Return JSON: {
  "suggested_new_time_iso": "...",
  "reasoning": "...",
  "alternative_times": [{ "iso": "...", "score": 0-1, "rationale": "..." }],
  "warnings": []
}`;
  const result = await callAIRaw(sys, user, { maxTokens: 2000 });
  return result || {
    suggested_new_time_iso: appointment.start_time,
    reasoning: 'AI not configured – returning original time.',
    alternative_times: [],
    warnings: ['AI service unavailable'],
  };
}

// 2. Meeting Duration Predictor
export async function predictMeetingDuration({ title, type, history }) {
  const sys = `You predict realistic meeting durations based on title patterns and historical actuals. Return JSON only.`;
  const user = `Title: ${title}
Type: ${type || 'unspecified'}
Historical similar meetings (title -> avg_minutes): ${JSON.stringify(history || [])}

Return JSON: {
  "predicted_minutes": <int>,
  "confidence": 0-1,
  "rationale": "...",
  "p10_minutes": <int>, "p50_minutes": <int>, "p90_minutes": <int>,
  "warning": "..."
}`;
  const r = await callAIRaw(sys, user, { maxTokens: 800 });
  return r || { predicted_minutes: 60, confidence: 0.4, rationale: 'AI not configured – default 60min.', p10_minutes: 30, p50_minutes: 60, p90_minutes: 120, warning: '' };
}

// 4. Meeting Transcript Summarizer
export async function summarizeTranscript({ transcript, attendees }) {
  const sys = `You summarise meeting transcripts. Output JSON only with action items and decisions.`;
  const user = `Attendees: ${JSON.stringify(attendees || [])}
Transcript:
${transcript}

Return JSON: {
  "summary": "1-paragraph",
  "decisions": ["..."],
  "action_items": [{ "owner": "name|unassigned", "task": "...", "due": "YYYY-MM-DD|null" }],
  "topics_covered": ["..."],
  "sentiment": "positive|neutral|negative"
}`;
  const r = await callAIRaw(sys, user, { maxTokens: 2500 });
  return r || { summary: 'Transcript summarisation unavailable (AI not configured).', decisions: [], action_items: [], topics_covered: [], sentiment: 'neutral' };
}

// 5. Attendee Sentiment Checker
export async function analyzeSentiment({ feedbackText, ratings, meetingTitle }) {
  const sys = `You are an analyst classifying post-meeting feedback. Return JSON only.`;
  const user = `Meeting: ${meetingTitle || 'unknown'}
Ratings 1-5 from attendees: ${JSON.stringify(ratings || [])}
Free-form feedback:
${feedbackText || ''}

Return JSON: {
  "overall_sentiment": "positive|neutral|negative",
  "score": 0-100,
  "themes": [{ "theme": "...", "polarity": "+|-|0", "frequency": <int> }],
  "recommended_format_change": "...",
  "trend_alert": "..."
}`;
  const r = await callAIRaw(sys, user, { maxTokens: 1500 });
  return r || { overall_sentiment: 'neutral', score: 50, themes: [], recommended_format_change: 'AI not configured.', trend_alert: '' };
}

// 6. Smart Recurring Pattern detection
export async function detectRecurringPatterns({ appointments }) {
  const sys = `You detect recurring meeting patterns in a list of appointments. Return JSON only.`;
  const user = `Appointments (titles + start_time iso): ${JSON.stringify(appointments)}

Return JSON: {
  "patterns": [{ "title_pattern": "...", "cadence": "daily|weekly|biweekly|monthly", "day_of_week": "...", "time": "HH:mm", "occurrences_observed": <int>, "next_suggested_iso": "..." }],
  "consolidation_suggestions": [{ "merge_titles": ["..."], "rationale": "..." }]
}`;
  const r = await callAIRaw(sys, user, { maxTokens: 2000 });
  return r || { patterns: [], consolidation_suggestions: [] };
}

// 7. Meeting Value ROI
export async function meetingValueROI({ meeting, salaryProxyPerHour, attendeeCount, agendaTopics }) {
  const sys = `You compute meeting ROI signals. Return JSON only.`;
  const user = `Meeting: ${JSON.stringify(meeting)}
Attendees: ${attendeeCount}
Salary proxy per hour: $${salaryProxyPerHour || 75}
Agenda topics: ${JSON.stringify(agendaTopics || [])}

Return JSON: {
  "estimated_cost_usd": <number>,
  "estimated_value_usd": <number>,
  "roi_score": 0-100,
  "verdict": "keep|shorten|cancel",
  "reasoning": "...",
  "recommended_format": "in-person|video|async-doc"
}`;
  const r = await callAIRaw(sys, user, { maxTokens: 1200 });
  return r || { estimated_cost_usd: 0, estimated_value_usd: 0, roi_score: 50, verdict: 'keep', reasoning: 'AI not configured.', recommended_format: 'video' };
}

// 8. Cross-Team Calendar Consensus
export async function teamConsensusSlots({ teamAvailabilities, durationMinutes, dateRange }) {
  const sys = `You rank candidate meeting slots across multiple teams to maximise collective availability. Return JSON only.`;
  const user = `Teams availability matrix: ${JSON.stringify(teamAvailabilities)}
Required duration (min): ${durationMinutes}
Date range: ${JSON.stringify(dateRange)}

Return JSON: {
  "ranked_slots": [{ "start_iso": "...", "end_iso": "...", "available_attendees": <int>, "total_attendees": <int>, "score": 0-1 }],
  "best_slot": "iso",
  "rationale": "..."
}`;
  const r = await callAIRaw(sys, user, { maxTokens: 2000 });
  return r || { ranked_slots: [], best_slot: null, rationale: 'AI not configured.' };
}

export { isAIConfigured, parseAIJson };
