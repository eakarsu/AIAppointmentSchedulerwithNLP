import pool from '../config/database.js';
import { processVoiceCommand, convertDateDescription } from '../services/openrouter.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.js';

export async function getAllVoiceCommands(req, res) {
  try {
    const { page, limit, offset, search, sort, order } = getPaginationParams(req.query);

    const allowedSorts = ['transcript', 'action_taken', 'created_at'];
    const sortColumn = allowedSorts.includes(sort) ? `v.${sort}` : 'v.created_at';

    let whereClause = 'WHERE v.user_id = $1';
    const params = [req.user.id];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (v.transcript ILIKE $${params.length} OR v.action_taken ILIKE $${params.length})`;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM voice_commands v ${whereClause}`, params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT v.*, a.title as appointment_title
       FROM voice_commands v
       LEFT JOIN appointments a ON v.appointment_id = a.id
       ${whereClause}
       ORDER BY ${sortColumn} DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json(formatPaginatedResponse(result.rows, total, page, limit));
  } catch (error) {
    console.error('Get voice commands error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getVoiceCommandById(req, res) {
  try {
    const result = await pool.query(
      `SELECT v.*, a.title as appointment_title FROM voice_commands v LEFT JOIN appointments a ON v.appointment_id = a.id WHERE v.id = $1 AND v.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Voice command not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get voice command error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function processCommand(req, res) {
  const { transcript } = req.body;
  if (!transcript) return res.status(400).json({ error: 'Transcript is required' });

  try {
    const parsed = await processVoiceCommand(transcript);
    let actionTaken = 'Command processed';
    let appointmentId = null;

    if (parsed.action === 'create') {
      let startDate = new Date();
      if (parsed.date) startDate = await convertDateDescription(parsed.date);
      if (parsed.time) {
        const timeParts = parsed.time.split(':');
        if (timeParts.length === 2) startDate.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), 0, 0);
      }
      const duration = parsed.duration || 60;
      const endDate = new Date(startDate.getTime() + duration * 60000);
      const aptResult = await pool.query(
        `INSERT INTO appointments (user_id, title, start_time, end_time, status) VALUES ($1, $2, $3, $4, 'scheduled') RETURNING *`,
        [req.user.id, parsed.title || 'New Appointment', startDate, endDate]
      );
      appointmentId = aptResult.rows[0].id;
      actionTaken = 'Created appointment';
    } else if (parsed.action === 'query') actionTaken = 'Displayed schedule';
    else if (parsed.action === 'delete') actionTaken = 'Delete requested';
    else if (parsed.action === 'reschedule') actionTaken = 'Reschedule requested';

    const result = await pool.query(
      `INSERT INTO voice_commands (user_id, transcript, action_taken, appointment_id) VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, transcript, actionTaken, appointmentId]
    );
    res.json({ command: result.rows[0], parsed, actionTaken });
  } catch (error) {
    console.error('Process voice command error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteVoiceCommand(req, res) {
  try {
    const result = await pool.query('DELETE FROM voice_commands WHERE id = $1 AND user_id = $2 RETURNING *', [req.params.id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Voice command not found' });
    res.json({ message: 'Voice command deleted successfully' });
  } catch (error) {
    console.error('Delete voice command error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}
