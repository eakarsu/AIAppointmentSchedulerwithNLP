import pool from '../config/database.js';
import { parseNaturalLanguage, convertDateDescription } from '../services/openrouter.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.js';
import { DateTime } from 'luxon';

// Convert a local datetime string + timezone to UTC ISO string
function toUTC(datetimeStr, timezone) {
  if (!timezone || !datetimeStr) return datetimeStr;
  try {
    const dt = DateTime.fromISO(datetimeStr, { zone: timezone });
    if (!dt.isValid) return datetimeStr;
    return dt.toUTC().toISO();
  } catch {
    return datetimeStr;
  }
}

// Convert a UTC datetime to a local datetime in a given timezone
function fromUTC(utcDatetime, timezone) {
  if (!timezone || !utcDatetime) return utcDatetime;
  try {
    return DateTime.fromJSDate(new Date(utcDatetime), { zone: 'UTC' }).setZone(timezone).toISO();
  } catch {
    return utcDatetime;
  }
}

// Enrich appointment rows with local time fields if timezone is stored
function enrichWithTimezone(rows, defaultTimezone) {
  return rows.map(row => {
    const tz = row.timezone || defaultTimezone;
    if (!tz) return row;
    return {
      ...row,
      start_time_local: fromUTC(row.start_time, tz),
      end_time_local: fromUTC(row.end_time, tz),
      timezone: tz,
    };
  });
}

export async function getAllAppointments(req, res) {
  try {
    const { page, limit, offset, search, sort, order } = getPaginationParams(req.query);

    const allowedSorts = ['title', 'start_time', 'end_time', 'status', 'created_at', 'location'];
    const sortColumn = allowedSorts.includes(sort) ? `a.${sort}` : 'a.start_time';

    let whereClause = 'WHERE a.user_id = $1';
    const params = [req.user.id];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (a.title ILIKE $${params.length} OR a.description ILIKE $${params.length} OR a.location ILIKE $${params.length})`;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM appointments a ${whereClause}`, params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT a.*, c.name as contact_name, c.email as contact_email
       FROM appointments a
       LEFT JOIN contacts c ON a.contact_id = c.id
       ${whereClause}
       ORDER BY ${sortColumn} ${order}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json(formatPaginatedResponse(result.rows, total, page, limit));
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getAppointmentById(req, res) {
  try {
    const result = await pool.query(
      `SELECT a.*, c.name as contact_name, c.email as contact_email, c.phone as contact_phone
       FROM appointments a
       LEFT JOIN contacts c ON a.contact_id = c.id
       WHERE a.id = $1 AND a.user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const enriched = enrichWithTimezone(result.rows, null);
    res.json(enriched[0]);
  } catch (error) {
    console.error('Get appointment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function createAppointment(req, res) {
  const { title, description, location, start_time, end_time, contact_id, status, timezone } = req.body;

  if (!title || !start_time || !end_time) {
    return res.status(400).json({ error: 'Title, start time, and end time are required' });
  }

  try {
    // Ensure timezone column exists (idempotent)
    await pool.query(`
      ALTER TABLE appointments ADD COLUMN IF NOT EXISTS timezone VARCHAR(100)
    `).catch(() => {});

    // Convert to UTC for storage if timezone is provided
    const startUTC = timezone ? toUTC(start_time, timezone) : start_time;
    const endUTC = timezone ? toUTC(end_time, timezone) : end_time;

    const result = await pool.query(
      `INSERT INTO appointments (user_id, title, description, location, start_time, end_time, contact_id, status, timezone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.user.id, title, description, location, startUTC, endUTC, contact_id || null, status || 'scheduled', timezone || null]
    );

    const enriched = enrichWithTimezone([result.rows[0]], timezone);
    res.status(201).json(enriched[0]);
  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function updateAppointment(req, res) {
  const { title, description, location, start_time, end_time, contact_id, status, timezone } = req.body;

  try {
    const existing = await pool.query(
      'SELECT * FROM appointments WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const tz = timezone || existing.rows[0].timezone;
    const startUTC = (start_time && tz) ? toUTC(start_time, tz) : start_time;
    const endUTC = (end_time && tz) ? toUTC(end_time, tz) : end_time;

    const result = await pool.query(
      `UPDATE appointments
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           location = COALESCE($3, location),
           start_time = COALESCE($4, start_time),
           end_time = COALESCE($5, end_time),
           contact_id = $6,
           status = COALESCE($7, status),
           timezone = COALESCE($8, timezone),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 AND user_id = $10
       RETURNING *`,
      [title, description, location, startUTC, endUTC, contact_id, status, tz, req.params.id, req.user.id]
    );

    const enriched = enrichWithTimezone([result.rows[0]], tz);
    res.json(enriched[0]);
  } catch (error) {
    console.error('Update appointment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteAppointment(req, res) {
  try {
    const result = await pool.query(
      'DELETE FROM appointments WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json({ message: 'Appointment deleted successfully' });
  } catch (error) {
    console.error('Delete appointment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function bulkDeleteAppointments(req, res) {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Array of IDs is required' });
  }
  try {
    const result = await pool.query(
      'DELETE FROM appointments WHERE id = ANY($1) AND user_id = $2 RETURNING id',
      [ids, req.user.id]
    );
    res.json({ message: `${result.rows.length} appointments deleted`, deleted: result.rows.map(r => r.id) });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function bulkUpdateAppointments(req, res) {
  const { ids, status } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0 || !status) {
    return res.status(400).json({ error: 'Array of IDs and status are required' });
  }
  try {
    const result = await pool.query(
      'UPDATE appointments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($2) AND user_id = $3 RETURNING id',
      [status, ids, req.user.id]
    );
    res.json({ message: `${result.rows.length} appointments updated`, updated: result.rows.map(r => r.id) });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function createFromNaturalLanguage(req, res) {
  const { input } = req.body;

  if (!input) {
    return res.status(400).json({ error: 'Input text is required' });
  }

  try {
    const parsed = await parseNaturalLanguage(input);

    await pool.query(
      'INSERT INTO nlp_logs (user_id, input_text, parsed_result, success) VALUES ($1, $2, $3, $4)',
      [req.user.id, input, JSON.stringify(parsed), !parsed.error]
    );

    if (parsed.error) {
      return res.status(400).json({ error: 'Could not parse input', details: parsed });
    }

    if (parsed.action === 'query') {
      const result = await pool.query(
        `SELECT * FROM appointments WHERE user_id = $1 ORDER BY start_time ASC LIMIT 10`,
        [req.user.id]
      );
      return res.json({ action: 'query', appointments: result.rows, parsed });
    }

    if (parsed.action === 'delete') {
      return res.json({ action: 'delete', parsed, message: 'Delete action recognized. Please specify which appointment to delete.' });
    }

    let startDate = new Date();
    if (parsed.date) {
      startDate = await convertDateDescription(parsed.date);
    }

    if (parsed.time) {
      const timeParts = parsed.time.split(':');
      if (timeParts.length === 2) {
        startDate.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), 0, 0);
      }
    }

    const duration = parsed.duration || 60;
    const endDate = new Date(startDate.getTime() + duration * 60000);

    let contactId = null;
    let contactName = null;
    if (parsed.contact) {
      const contactParts = parsed.contact.split(/\s+/);
      const lastName = contactParts[contactParts.length - 1];

      let contactResult = await pool.query(
        'SELECT id, name FROM contacts WHERE user_id = $1 AND LOWER(name) LIKE LOWER($2) LIMIT 1',
        [req.user.id, `%${parsed.contact}%`]
      );

      if (contactResult.rows.length === 0 && lastName.length > 2) {
        contactResult = await pool.query(
          'SELECT id, name FROM contacts WHERE user_id = $1 AND LOWER(name) LIKE LOWER($2) LIMIT 1',
          [req.user.id, `%${lastName}%`]
        );
      }

      if (contactResult.rows.length > 0) {
        contactId = contactResult.rows[0].id;
        contactName = contactResult.rows[0].name;
      } else {
        const newContact = await pool.query(
          'INSERT INTO contacts (user_id, name, notes) VALUES ($1, $2, $3) RETURNING id, name',
          [req.user.id, parsed.contact, 'Auto-created from NLP']
        );
        contactId = newContact.rows[0].id;
        contactName = newContact.rows[0].name;
      }
    }

    let title = parsed.title;
    if (!title || title === 'New Appointment') {
      if (contactName) {
        const lowerInput = input.toLowerCase();
        if (lowerInput.includes('meeting')) title = `Meeting with ${contactName}`;
        else if (lowerInput.includes('call') || lowerInput.includes('phone')) title = `Call with ${contactName}`;
        else if (lowerInput.includes('lunch')) title = `Lunch with ${contactName}`;
        else if (lowerInput.includes('dinner')) title = `Dinner with ${contactName}`;
        else if (lowerInput.includes('coffee')) title = `Coffee with ${contactName}`;
        else if (lowerInput.includes('appointment')) title = `Appointment with ${contactName}`;
        else title = `Meeting with ${contactName}`;
      } else if (parsed.contact) {
        title = `Meeting with ${parsed.contact}`;
      }
    }

    const result = await pool.query(
      `INSERT INTO appointments (user_id, title, description, location, start_time, end_time, contact_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled')
       RETURNING *`,
      [req.user.id, title || 'New Appointment', parsed.description || '', parsed.location || '', startDate, endDate, contactId]
    );

    res.status(201).json({
      action: 'create',
      appointment: result.rows[0],
      parsed
    });
  } catch (error) {
    console.error('Create from NLP error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function exportAppointmentsCSV(req, res) {
  try {
    const result = await pool.query(
      `SELECT a.start_time, a.end_time, a.title, c.name as client_name,
              a.location, a.status, a.description, a.timezone
       FROM appointments a
       LEFT JOIN contacts c ON a.contact_id = c.id
       WHERE a.user_id = $1
       ORDER BY a.start_time ASC`,
      [req.user.id]
    );

    const rows = result.rows;
    const headers = ['date', 'time', 'type', 'client_name', 'duration', 'status', 'notes'];

    const csvLines = [headers.join(',')];
    rows.forEach(r => {
      const start = new Date(r.start_time);
      const end = new Date(r.end_time);
      const durationMin = Math.round((end - start) / 60000);
      const date = start.toISOString().split('T')[0];
      const time = start.toTimeString().slice(0, 5);

      const escape = (val) => {
        if (val == null) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      csvLines.push([
        escape(date),
        escape(time),
        escape(r.title),
        escape(r.client_name),
        escape(durationMin),
        escape(r.status),
        escape(r.description),
      ].join(','));
    });

    const csv = csvLines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="appointments.csv"');
    res.send(csv);
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getUpcoming(req, res) {
  try {
    const result = await pool.query(
      `SELECT a.*, c.name as contact_name
       FROM appointments a
       LEFT JOIN contacts c ON a.contact_id = c.id
       WHERE a.user_id = $1 AND a.start_time > NOW()
       ORDER BY a.start_time ASC
       LIMIT 10`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get upcoming error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}
