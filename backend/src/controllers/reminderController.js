import pool from '../config/database.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.js';
import { sendEmailReminder, sendSMSReminder } from '../services/notificationService.js';

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

// Process and send due reminders - called manually or by a cron job
export async function sendDueReminders(req, res) {
  try {
    // Fetch reminders that are due (remind_at <= now) and not yet sent
    const result = await pool.query(`
      SELECT r.*, a.title, a.start_time, a.end_time, a.location, a.description,
             c.name as contact_name, c.email as contact_email, c.phone as contact_phone,
             u.email as user_email
      FROM reminders r
      JOIN appointments a ON r.appointment_id = a.id
      JOIN users u ON a.user_id = u.id
      LEFT JOIN contacts c ON a.contact_id = c.id
      WHERE r.sent = FALSE AND r.remind_at <= NOW()
      ORDER BY r.remind_at ASC
      LIMIT 50
    `);

    const reminders = result.rows;
    const results = [];

    for (const reminder of reminders) {
      const apt = {
        id: reminder.appointment_id,
        title: reminder.title,
        start_time: reminder.start_time,
        end_time: reminder.end_time,
        location: reminder.location,
        description: reminder.description,
        contact_name: reminder.contact_name,
        contact_email: reminder.contact_email,
        user_email: reminder.user_email,
      };

      try {
        if (reminder.type === 'email' || reminder.type === 'both') {
          await sendEmailReminder(apt);
        }
        if ((reminder.type === 'sms' || reminder.type === 'both') && reminder.contact_phone) {
          await sendSMSReminder(apt, reminder.contact_phone);
        }

        // Mark as sent
        await pool.query('UPDATE reminders SET sent = TRUE WHERE id = $1', [reminder.id]);
        results.push({ reminder_id: reminder.id, appointment_id: reminder.appointment_id, status: 'sent' });
      } catch (sendErr) {
        console.error(`[reminderController] Failed to send reminder ${reminder.id}:`, sendErr.message);
        results.push({ reminder_id: reminder.id, appointment_id: reminder.appointment_id, status: 'failed', error: sendErr.message });
      }
    }

    res.json({ processed: reminders.length, results });
  } catch (error) {
    console.error('Send due reminders error:', error);
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
