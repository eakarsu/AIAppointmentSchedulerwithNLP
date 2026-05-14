import pool from '../config/database.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.js';

export async function getAllContacts(req, res) {
  try {
    const { page, limit, offset, search, sort, order } = getPaginationParams(req.query);

    const allowedSorts = ['name', 'email', 'company', 'created_at'];
    const sortColumn = allowedSorts.includes(sort) ? sort : 'name';

    let whereClause = 'WHERE user_id = $1';
    const params = [req.user.id];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length} OR phone ILIKE $${params.length} OR company ILIKE $${params.length})`;
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM contacts ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT * FROM contacts ${whereClause} ORDER BY ${sortColumn} ${order} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json(formatPaginatedResponse(result.rows, total, page, limit));
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getContactById(req, res) {
  try {
    const result = await pool.query(
      'SELECT * FROM contacts WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get contact error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function createContact(req, res) {
  const { name, email, phone, company, notes } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO contacts (user_id, name, email, phone, company, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.id, name, email, phone, company, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create contact error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function updateContact(req, res) {
  const { name, email, phone, company, notes } = req.body;
  try {
    const existing = await pool.query('SELECT * FROM contacts WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    const result = await pool.query(
      `UPDATE contacts SET name = COALESCE($1, name), email = COALESCE($2, email), phone = COALESCE($3, phone), company = COALESCE($4, company), notes = COALESCE($5, notes), updated_at = CURRENT_TIMESTAMP WHERE id = $6 AND user_id = $7 RETURNING *`,
      [name, email, phone, company, notes, req.params.id, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteContact(req, res) {
  try {
    const result = await pool.query('DELETE FROM contacts WHERE id = $1 AND user_id = $2 RETURNING *', [req.params.id, req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function bulkDeleteContacts(req, res) {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Array of IDs is required' });
  }
  try {
    const result = await pool.query('DELETE FROM contacts WHERE id = ANY($1) AND user_id = $2 RETURNING id', [ids, req.user.id]);
    res.json({ message: `${result.rows.length} contacts deleted`, deleted: result.rows.map(r => r.id) });
  } catch (error) {
    console.error('Bulk delete contacts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Contact Relationship Intelligence: contacts not met with in the last N days
export async function getOverdueContacts(req, res) {
  const days = Math.min(365, Math.max(1, parseInt(req.query.days) || 30));
  try {
    const result = await pool.query(
      `SELECT
         c.id, c.name, c.email, c.company,
         COUNT(a.id) as total_meetings,
         MAX(a.start_time) as last_meeting_at,
         EXTRACT(DAY FROM NOW() - MAX(a.start_time))::int as days_since_last_meeting
       FROM contacts c
       LEFT JOIN appointments a ON a.contact_id = c.id AND a.user_id = c.user_id
       WHERE c.user_id = $1
       GROUP BY c.id, c.name, c.email, c.company
       HAVING MAX(a.start_time) IS NULL OR MAX(a.start_time) < NOW() - INTERVAL '1 day' * $2
       ORDER BY last_meeting_at ASC NULLS FIRST
       LIMIT 50`,
      [req.user.id, days]
    );
    res.json({
      days_threshold: days,
      count: result.rows.length,
      contacts: result.rows.map(c => ({
        ...c,
        days_since_last_meeting: c.days_since_last_meeting ?? null,
        status: c.last_meeting_at ? 'overdue' : 'never_met',
      })),
    });
  } catch (error) {
    console.error('getOverdueContacts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}
