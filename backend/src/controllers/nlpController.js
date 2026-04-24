import pool from '../config/database.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.js';
import {
  parseNaturalLanguage,
  generateAppointmentSuggestion,
  chatWithAssistant,
  generateScheduleInsights,
  findContactMatch,
  suggestCategory,
  analyzeConflicts,
  suggestReminders,
  generateAppointmentTitle,
  isAIConfigured
} from '../services/openrouter.js';

export async function getAllNlpLogs(req, res) {
  try {
    const { page, limit, offset, search, sort, order } = getPaginationParams(req.query);

    const allowedSorts = ['input_text', 'success', 'created_at'];
    const sortColumn = allowedSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = sort === 'created_at' && order === 'ASC' ? 'DESC' : order;

    let whereClause = 'WHERE user_id = $1';
    const params = [req.user.id];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (input_text ILIKE $${params.length})`;
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM nlp_logs ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT * FROM nlp_logs ${whereClause} ORDER BY ${sortColumn} ${sortColumn === 'created_at' ? 'DESC' : order} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json(formatPaginatedResponse(result.rows, total, page, limit));
  } catch (error) {
    console.error('Get NLP logs error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getNlpLogById(req, res) {
  try {
    const result = await pool.query('SELECT * FROM nlp_logs WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'NLP log not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get NLP log error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function parseText(req, res) {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });
  try {
    const result = await parseNaturalLanguage(text);
    await pool.query(
      'INSERT INTO nlp_logs (user_id, input_text, parsed_result, success) VALUES ($1, $2, $3, $4)',
      [req.user.id, text, JSON.stringify(result), !result.error]
    );
    res.json({ ...result, ai_powered: isAIConfigured() });
  } catch (error) {
    console.error('Parse text error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getSuggestions(req, res) {
  try {
    const appointments = await pool.query(
      `SELECT title, start_time, end_time, location, description FROM appointments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [req.user.id]
    );
    const context = {
      recent_appointments: appointments.rows,
      request: req.body.request || 'Suggest optimal appointment times',
      preferences: req.body.preferences || {}
    };
    const suggestions = await generateAppointmentSuggestion(context);
    res.json({ ...suggestions, ai_powered: isAIConfigured() });
  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function chat(req, res) {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });
  try {
    const [upcoming, today] = await Promise.all([
      pool.query(`SELECT title, start_time FROM appointments WHERE user_id = $1 AND start_time > NOW() ORDER BY start_time LIMIT 1`, [req.user.id]),
      pool.query(`SELECT COUNT(*) FROM appointments WHERE user_id = $1 AND DATE(start_time) = CURRENT_DATE`, [req.user.id])
    ]);
    const appointmentCount = await pool.query('SELECT COUNT(*) FROM appointments WHERE user_id = $1', [req.user.id]);
    const context = {
      appointmentCount: parseInt(appointmentCount.rows[0].count),
      nextAppointment: upcoming.rows[0] ? `${upcoming.rows[0].title} at ${new Date(upcoming.rows[0].start_time).toLocaleString()}` : null,
      todayCount: parseInt(today.rows[0].count)
    };
    const response = await chatWithAssistant(message, context);
    await pool.query(
      'INSERT INTO nlp_logs (user_id, input_text, parsed_result, success) VALUES ($1, $2, $3, $4)',
      [req.user.id, `[CHAT] ${message}`, JSON.stringify(response), true]
    );
    res.json({ ...response, ai_powered: isAIConfigured() });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getInsights(req, res) {
  const { period = 'week' } = req.query;
  try {
    let dateFilter = '';
    if (period === 'day') dateFilter = "AND DATE(start_time) = CURRENT_DATE";
    else if (period === 'week') dateFilter = "AND start_time >= CURRENT_DATE AND start_time < CURRENT_DATE + INTERVAL '7 days'";
    else if (period === 'month') dateFilter = "AND start_time >= CURRENT_DATE AND start_time < CURRENT_DATE + INTERVAL '30 days'";

    const appointments = await pool.query(
      `SELECT title, start_time, end_time, location, status, description FROM appointments WHERE user_id = $1 ${dateFilter} ORDER BY start_time`,
      [req.user.id]
    );
    const insights = await generateScheduleInsights(appointments.rows, period);
    res.json({ ...insights, period, appointment_count: appointments.rows.length, ai_powered: isAIConfigured() });
  } catch (error) {
    console.error('Get insights error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function matchContact(req, res) {
  const { search } = req.body;
  if (!search) return res.status(400).json({ error: 'Search text is required' });
  try {
    const contacts = await pool.query('SELECT * FROM contacts WHERE user_id = $1', [req.user.id]);
    const result = await findContactMatch(search, contacts.rows);
    res.json({ ...result, ai_powered: isAIConfigured() });
  } catch (error) {
    console.error('Match contact error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function suggestAppointmentCategory(req, res) {
  const { appointment } = req.body;
  if (!appointment) return res.status(400).json({ error: 'Appointment details required' });
  try {
    const categories = await pool.query('SELECT * FROM categories WHERE user_id = $1', [req.user.id]);
    const result = await suggestCategory(appointment, categories.rows);
    res.json({ ...result, ai_powered: isAIConfigured() });
  } catch (error) {
    console.error('Suggest category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function checkConflicts(req, res) {
  const { appointment } = req.body;
  if (!appointment || !appointment.start_time || !appointment.end_time) {
    return res.status(400).json({ error: 'Appointment with start_time and end_time required' });
  }
  try {
    const existing = await pool.query(
      `SELECT * FROM appointments WHERE user_id = $1 AND DATE(start_time) = DATE($2::timestamp) AND id != $3`,
      [req.user.id, appointment.start_time, appointment.id || 0]
    );
    const result = await analyzeConflicts(appointment, existing.rows);
    res.json({ ...result, ai_powered: isAIConfigured() });
  } catch (error) {
    console.error('Check conflicts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function suggestAppointmentReminders(req, res) {
  const { appointment } = req.body;
  if (!appointment) return res.status(400).json({ error: 'Appointment details required' });
  try {
    const settings = await pool.query('SELECT * FROM settings WHERE user_id = $1', [req.user.id]);
    const result = await suggestReminders(appointment, settings.rows[0] || {});
    res.json({ ...result, ai_powered: isAIConfigured() });
  } catch (error) {
    console.error('Suggest reminders error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function generateTitle(req, res) {
  const { details } = req.body;
  if (!details) return res.status(400).json({ error: 'Details required' });
  try {
    const result = await generateAppointmentTitle(details);
    res.json({ ...result, ai_powered: isAIConfigured() });
  } catch (error) {
    console.error('Generate title error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteNlpLog(req, res) {
  try {
    const result = await pool.query('DELETE FROM nlp_logs WHERE id = $1 AND user_id = $2 RETURNING *', [req.params.id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'NLP log not found' });
    res.json({ message: 'NLP log deleted successfully' });
  } catch (error) {
    console.error('Delete NLP log error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getAIStatus(req, res) {
  res.json({
    configured: isAIConfigured(),
    features: [
      'Natural Language Parsing', 'Smart Scheduling Suggestions', 'AI Chat Assistant',
      'Schedule Insights', 'Smart Contact Matching', 'Auto-categorization',
      'Conflict Detection', 'Smart Reminders', 'Title Generation'
    ]
  });
}
