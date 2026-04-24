import pool from '../config/database.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.js';

export async function getAllReminders(req, res) {
  try {
    const { page, limit, offset, search, sort, order } = getPaginationParams(req.query);

    const allowedSorts = ['remind_at', 'type', 'sent', 'created_at'];
    const sortColumn = allowedSorts.includes(sort) ? `r.${sort}` : 'r.remind_at';

    let whereClause = 'WHERE a.user_id = $1';
    const params = [req.user.id];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (a.title ILIKE $${params.length})`;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM reminders r JOIN appointments a ON r.appointment_id = a.id ${whereClause}`, params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT r.*, a.title as appointment_title, a.start_time as appointment_time
       FROM reminders r
       JOIN appointments a ON r.appointment_id = a.id
       ${whereClause}
       ORDER BY ${sortColumn} ${order}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json(formatPaginatedResponse(result.rows, total, page, limit));
  } catch (error) {
    console.error('Get reminders error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getReminderById(req, res) {
  try {
    const result = await pool.query(
      `SELECT r.*, a.title as appointment_title, a.start_time as appointment_time
       FROM reminders r JOIN appointments a ON r.appointment_id = a.id
       WHERE r.id = $1 AND a.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Reminder not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get reminder error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function createReminder(req, res) {
  const { appointment_id, remind_at, type } = req.body;
  if (!appointment_id || !remind_at) return res.status(400).json({ error: 'Appointment ID and remind time are required' });
  try {
    const aptCheck = await pool.query('SELECT id FROM appointments WHERE id = $1 AND user_id = $2', [appointment_id, req.user.id]);
    if (aptCheck.rows.length === 0) return res.status(404).json({ error: 'Appointment not found' });
    const result = await pool.query(
      `INSERT INTO reminders (appointment_id, remind_at, type) VALUES ($1, $2, $3) RETURNING *`,
      [appointment_id, remind_at, type || 'email']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create reminder error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function updateReminder(req, res) {
  const { remind_at, type, sent } = req.body;
  try {
    const existing = await pool.query(
      `SELECT r.* FROM reminders r JOIN appointments a ON r.appointment_id = a.id WHERE r.id = $1 AND a.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Reminder not found' });
    const result = await pool.query(
      `UPDATE reminders SET remind_at = COALESCE($1, remind_at), type = COALESCE($2, type), sent = COALESCE($3, sent) WHERE id = $4 RETURNING *`,
      [remind_at, type, sent, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update reminder error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteReminder(req, res) {
  try {
    const existing = await pool.query(
      `SELECT r.* FROM reminders r JOIN appointments a ON r.appointment_id = a.id WHERE r.id = $1 AND a.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Reminder not found' });
    await pool.query('DELETE FROM reminders WHERE id = $1', [req.params.id]);
    res.json({ message: 'Reminder deleted successfully' });
  } catch (error) {
    console.error('Delete reminder error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function bulkDeleteReminders(req, res) {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Array of IDs is required' });
  try {
    const result = await pool.query(
      `DELETE FROM reminders WHERE id = ANY($1) AND appointment_id IN (SELECT id FROM appointments WHERE user_id = $2) RETURNING id`,
      [ids, req.user.id]
    );
    res.json({ message: `${result.rows.length} reminders deleted`, deleted: result.rows.map(r => r.id) });
  } catch (error) {
    console.error('Bulk delete reminders error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}
