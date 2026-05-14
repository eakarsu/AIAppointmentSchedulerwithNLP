import pool from '../config/database.js';
import {
  smartTimezoneReschedule,
  predictMeetingDuration,
  summarizeTranscript,
  analyzeSentiment,
  detectRecurringPatterns,
  meetingValueROI,
  teamConsensusSlots,
  isAIConfigured,
} from '../services/openrouterExtras.js';

// Ensure tables exist (idempotent, fault-tolerant)
async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meeting_duration_predictions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255),
      type VARCHAR(100),
      predicted_minutes INTEGER,
      ai_results JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS meeting_transcripts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
      transcript TEXT NOT NULL,
      ai_results JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS meeting_feedback (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
      rating INTEGER,
      feedback_text TEXT,
      ai_results JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS meeting_roi_analyses (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
      ai_results JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS recurring_pattern_detections (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      ai_results JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS timezone_reschedules (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
      from_tz VARCHAR(100),
      to_tz VARCHAR(100),
      ai_results JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS team_consensus_runs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      duration_minutes INTEGER,
      ai_results JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// 1. Time-zone Smart Rescheduling
export async function tzReschedule(req, res) {
  try {
    await ensureTables();
    const { appointment_id, to_timezone, from_timezone, work_hours } = req.body;
    if (!appointment_id || !to_timezone) {
      return res.status(400).json({ error: 'appointment_id and to_timezone are required' });
    }
    const apt = await pool.query('SELECT * FROM appointments WHERE id = $1 AND user_id = $2', [appointment_id, req.user.id]);
    if (apt.rows.length === 0) return res.status(404).json({ error: 'Appointment not found' });
    const settings = await pool.query('SELECT * FROM settings WHERE user_id = $1', [req.user.id]);
    const fromTz = from_timezone || settings.rows[0]?.timezone || 'UTC';
    const result = await smartTimezoneReschedule({ appointment: apt.rows[0], fromTimezone: fromTz, toTimezone: to_timezone, workHours: work_hours });
    const ins = await pool.query(
      `INSERT INTO timezone_reschedules (user_id, appointment_id, from_tz, to_tz, ai_results) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, appointment_id, fromTz, to_timezone, JSON.stringify(result)]
    );
    res.json({ result, saved: ins.rows[0], ai_powered: isAIConfigured() });
  } catch (e) {
    console.error('tzReschedule error:', e.message);
    res.status(500).json({ error: e.message });
  }
}

// 2. Meeting Duration Predictor
export async function durationPredict(req, res) {
  try {
    await ensureTables();
    const { title, type } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    const history = await pool.query(
      `SELECT title, AVG(EXTRACT(EPOCH FROM (end_time - start_time))/60) as avg_minutes
       FROM appointments WHERE user_id = $1 AND title ILIKE $2 GROUP BY title LIMIT 20`,
      [req.user.id, `%${title.split(' ')[0]}%`]
    );
    const result = await predictMeetingDuration({ title, type, history: history.rows });
    const ins = await pool.query(
      `INSERT INTO meeting_duration_predictions (user_id, title, type, predicted_minutes, ai_results) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, title, type || null, result.predicted_minutes || 60, JSON.stringify(result)]
    );
    res.json({ result, saved: ins.rows[0], ai_powered: isAIConfigured() });
  } catch (e) {
    console.error('durationPredict error:', e.message);
    res.status(500).json({ error: e.message });
  }
}

export async function listDurationPredictions(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const total = await pool.query('SELECT COUNT(*) FROM meeting_duration_predictions WHERE user_id = $1', [req.user.id]);
    const rows = await pool.query(
      'SELECT * FROM meeting_duration_predictions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [req.user.id, limit, offset]
    );
    res.json({ data: rows.rows, pagination: { page, limit, total: parseInt(total.rows[0].count), totalPages: Math.ceil(total.rows[0].count / limit) } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// 3. Calendar Heatmap (extended)
export async function calendarHeatmap(req, res) {
  try {
    const result = await pool.query(
      `SELECT
         EXTRACT(DOW FROM start_time)::int AS dow,
         EXTRACT(HOUR FROM start_time)::int AS hour,
         COUNT(*) AS count
       FROM appointments
       WHERE user_id = $1
       GROUP BY dow, hour
       ORDER BY dow, hour`,
      [req.user.id]
    );
    // Build 7x24 grid
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
    result.rows.forEach((r) => {
      grid[r.dow][r.hour] = parseInt(r.count);
    });
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const formatted = grid.map((row, i) => ({
      day: days[i],
      day_index: i,
      hours: row.map((count, h) => ({ hour: h, count })),
      total: row.reduce((a, b) => a + b, 0),
    }));
    // Find underbooked slots
    const allCounts = grid.flat();
    const max = Math.max(...allCounts, 1);
    const underbooked = [];
    for (let d = 0; d < 7; d++) {
      for (let h = 8; h <= 18; h++) {
        if (grid[d][h] / max < 0.2) underbooked.push({ day: days[d], hour: h, count: grid[d][h] });
      }
    }
    res.json({ heatmap: formatted, max_count: max, underbooked_slots: underbooked.slice(0, 20) });
  } catch (e) {
    console.error('calendarHeatmap error:', e.message);
    res.status(500).json({ error: e.message });
  }
}

// 4. Meeting Transcript Summarizer
export async function summarize(req, res) {
  try {
    await ensureTables();
    const { transcript, appointment_id, attendees } = req.body;
    if (!transcript) return res.status(400).json({ error: 'transcript is required' });
    const result = await summarizeTranscript({ transcript, attendees });
    const ins = await pool.query(
      `INSERT INTO meeting_transcripts (user_id, appointment_id, transcript, ai_results) VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, appointment_id || null, transcript, JSON.stringify(result)]
    );
    res.json({ result, saved: ins.rows[0], ai_powered: isAIConfigured() });
  } catch (e) {
    console.error('summarize error:', e.message);
    res.status(500).json({ error: e.message });
  }
}

export async function listTranscripts(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const total = await pool.query('SELECT COUNT(*) FROM meeting_transcripts WHERE user_id = $1', [req.user.id]);
    const rows = await pool.query(
      `SELECT t.*, a.title as appointment_title FROM meeting_transcripts t LEFT JOIN appointments a ON t.appointment_id = a.id
       WHERE t.user_id = $1 ORDER BY t.created_at DESC LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );
    res.json({ data: rows.rows, pagination: { page, limit, total: parseInt(total.rows[0].count), totalPages: Math.ceil(total.rows[0].count / limit) } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// 5. Attendee Sentiment Checker
export async function analyzeAttendeeSentiment(req, res) {
  try {
    await ensureTables();
    const { feedback_text, ratings, appointment_id, meeting_title } = req.body;
    const result = await analyzeSentiment({ feedbackText: feedback_text, ratings, meetingTitle: meeting_title });
    const ratingNum = Array.isArray(ratings) && ratings.length ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length) : null;
    const ins = await pool.query(
      `INSERT INTO meeting_feedback (user_id, appointment_id, rating, feedback_text, ai_results) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, appointment_id || null, ratingNum, feedback_text || null, JSON.stringify(result)]
    );
    res.json({ result, saved: ins.rows[0], ai_powered: isAIConfigured() });
  } catch (e) {
    console.error('analyzeAttendeeSentiment error:', e.message);
    res.status(500).json({ error: e.message });
  }
}

export async function listFeedback(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const total = await pool.query('SELECT COUNT(*) FROM meeting_feedback WHERE user_id = $1', [req.user.id]);
    const rows = await pool.query(
      `SELECT f.*, a.title as appointment_title FROM meeting_feedback f LEFT JOIN appointments a ON f.appointment_id = a.id
       WHERE f.user_id = $1 ORDER BY f.created_at DESC LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );
    res.json({ data: rows.rows, pagination: { page, limit, total: parseInt(total.rows[0].count), totalPages: Math.ceil(total.rows[0].count / limit) } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// 6. Smart Recurring Pattern detection
export async function recurringPatterns(req, res) {
  try {
    await ensureTables();
    const apts = await pool.query(
      `SELECT id, title, start_time FROM appointments WHERE user_id = $1 ORDER BY start_time DESC LIMIT 200`,
      [req.user.id]
    );
    const result = await detectRecurringPatterns({ appointments: apts.rows });
    const ins = await pool.query(
      `INSERT INTO recurring_pattern_detections (user_id, ai_results) VALUES ($1, $2) RETURNING *`,
      [req.user.id, JSON.stringify(result)]
    );
    res.json({ result, saved: ins.rows[0], ai_powered: isAIConfigured() });
  } catch (e) {
    console.error('recurringPatterns error:', e.message);
    res.status(500).json({ error: e.message });
  }
}

// 7. Meeting Value ROI
export async function meetingROI(req, res) {
  try {
    await ensureTables();
    const { appointment_id, salary_proxy_per_hour, attendee_count, agenda_topics } = req.body;
    if (!appointment_id) return res.status(400).json({ error: 'appointment_id is required' });
    const apt = await pool.query('SELECT * FROM appointments WHERE id = $1 AND user_id = $2', [appointment_id, req.user.id]);
    if (apt.rows.length === 0) return res.status(404).json({ error: 'Appointment not found' });
    const result = await meetingValueROI({ meeting: apt.rows[0], salaryProxyPerHour: salary_proxy_per_hour || 75, attendeeCount: attendee_count || 1, agendaTopics: agenda_topics });
    const ins = await pool.query(
      `INSERT INTO meeting_roi_analyses (user_id, appointment_id, ai_results) VALUES ($1, $2, $3) RETURNING *`,
      [req.user.id, appointment_id, JSON.stringify(result)]
    );
    res.json({ result, saved: ins.rows[0], ai_powered: isAIConfigured() });
  } catch (e) {
    console.error('meetingROI error:', e.message);
    res.status(500).json({ error: e.message });
  }
}

export async function listROI(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const total = await pool.query('SELECT COUNT(*) FROM meeting_roi_analyses WHERE user_id = $1', [req.user.id]);
    const rows = await pool.query(
      `SELECT r.*, a.title as appointment_title FROM meeting_roi_analyses r LEFT JOIN appointments a ON r.appointment_id = a.id
       WHERE r.user_id = $1 ORDER BY r.created_at DESC LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );
    res.json({ data: rows.rows, pagination: { page, limit, total: parseInt(total.rows[0].count), totalPages: Math.ceil(total.rows[0].count / limit) } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// 8. Cross-Team Calendar Consensus
export async function teamConsensus(req, res) {
  try {
    await ensureTables();
    const { team_availabilities, duration_minutes, date_range } = req.body;
    if (!team_availabilities || !duration_minutes) {
      return res.status(400).json({ error: 'team_availabilities and duration_minutes are required' });
    }
    const result = await teamConsensusSlots({ teamAvailabilities: team_availabilities, durationMinutes: duration_minutes, dateRange: date_range });
    const ins = await pool.query(
      `INSERT INTO team_consensus_runs (user_id, duration_minutes, ai_results) VALUES ($1, $2, $3) RETURNING *`,
      [req.user.id, duration_minutes, JSON.stringify(result)]
    );
    res.json({ result, saved: ins.rows[0], ai_powered: isAIConfigured() });
  } catch (e) {
    console.error('teamConsensus error:', e.message);
    res.status(500).json({ error: e.message });
  }
}
