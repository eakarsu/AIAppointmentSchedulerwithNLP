import pool from '../config/database.js';

export async function getSettings(req, res) {
  try {
    const result = await pool.query(
      'SELECT * FROM settings WHERE user_id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      // Create default settings if not exists
      const newSettings = await pool.query(
        `INSERT INTO settings (user_id) VALUES ($1) RETURNING *`,
        [req.user.id]
      );
      return res.json(newSettings.rows[0]);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function updateSettings(req, res) {
  const { timezone, notification_email, notification_sms, default_reminder_minutes, theme } = req.body;

  try {
    const existing = await pool.query(
      'SELECT * FROM settings WHERE user_id = $1',
      [req.user.id]
    );

    if (existing.rows.length === 0) {
      // Create settings if not exists
      const result = await pool.query(
        `INSERT INTO settings (user_id, timezone, notification_email, notification_sms, default_reminder_minutes, theme)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [req.user.id, timezone || 'UTC', notification_email ?? true, notification_sms ?? false, default_reminder_minutes || 30, theme || 'light']
      );
      return res.json(result.rows[0]);
    }

    const result = await pool.query(
      `UPDATE settings
       SET timezone = COALESCE($1, timezone),
           notification_email = COALESCE($2, notification_email),
           notification_sms = COALESCE($3, notification_sms),
           default_reminder_minutes = COALESCE($4, default_reminder_minutes),
           theme = COALESCE($5, theme),
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $6
       RETURNING *`,
      [timezone, notification_email, notification_sms, default_reminder_minutes, theme, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getAllSettings(req, res) {
  // Admin only endpoint to see all user settings
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const result = await pool.query(
      `SELECT s.*, u.name as user_name, u.email as user_email
       FROM settings s
       JOIN users u ON s.user_id = u.id
       ORDER BY u.name ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get all settings error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}
