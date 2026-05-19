import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../config/database.js';
import PDFDocument from 'pdfkit';

const router = Router();
router.use(authenticateToken);

// VIZ 1: APPOINTMENT CALENDAR - returns appointments grouped by day with provider color info
router.get('/calendar', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.id, a.title, a.description, a.location, a.start_time, a.end_time,
              a.status, a.contact_id,
              COALESCE(c.name, 'Unassigned') AS provider_name,
              COALESCE(c.company, '') AS provider_company
       FROM appointments a
       LEFT JOIN contacts c ON c.id = a.contact_id
       ORDER BY a.start_time ASC`
    );

    const statusColors = {
      scheduled: '#3B82F6',
      confirmed: '#10B981',
      completed: '#22C55E',
      cancelled: '#EF4444',
      'no-show': '#F59E0B',
      pending: '#A855F7'
    };

    // Build a stable color per provider
    const providerSet = new Map();
    const palette = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#84CC16', '#14B8A6', '#A855F7', '#6366F1'];
    for (const row of result.rows) {
      if (!providerSet.has(row.provider_name)) {
        providerSet.set(row.provider_name, palette[providerSet.size % palette.length]);
      }
    }

    const appointments = result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      location: row.location,
      start_time: row.start_time,
      end_time: row.end_time,
      status: row.status,
      provider_name: row.provider_name,
      provider_company: row.provider_company,
      provider_color: providerSet.get(row.provider_name),
      status_color: statusColors[row.status] || '#64748B'
    }));

    res.json({
      appointments,
      providers: Array.from(providerSet.entries()).map(([name, color]) => ({ name, color })),
      status_colors: statusColors,
      total: appointments.length
    });
  } catch (err) {
    console.error('GET /api/custom-views/calendar error:', err);
    res.status(500).json({ error: 'Failed to load calendar' });
  }
});

// VIZ 2: BUSY HOURS HEATMAP - 7 days x 24 hours grid showing booking density
router.get('/heatmap', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT start_time FROM appointments WHERE start_time IS NOT NULL`
    );

    // Build 7x24 grid (rows = day of week 0..6 Sun..Sat, cols = hour 0..23)
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
    let total = 0;
    for (const row of result.rows) {
      const d = new Date(row.start_time);
      if (isNaN(d.getTime())) continue;
      const dow = d.getDay();
      const hour = d.getHours();
      grid[dow][hour] += 1;
      total += 1;
    }

    let max = 0;
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        if (grid[d][h] > max) max = grid[d][h];
      }
    }

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    res.json({
      grid,
      days,
      hours: Array.from({ length: 24 }, (_, i) => i),
      max,
      total
    });
  } catch (err) {
    console.error('GET /api/custom-views/heatmap error:', err);
    res.status(500).json({ error: 'Failed to load heatmap' });
  }
});

// NON-VIZ 1: SMS REMINDER DISPATCH - send reminders for selected upcoming appointments
router.get('/upcoming', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.id, a.title, a.start_time, a.end_time, a.location, a.status,
              COALESCE(c.name, 'Unassigned') AS contact_name,
              COALESCE(c.phone, '') AS contact_phone
       FROM appointments a
       LEFT JOIN contacts c ON c.id = a.contact_id
       WHERE a.start_time >= NOW()
       ORDER BY a.start_time ASC
       LIMIT 50`
    );
    res.json({ appointments: result.rows, total: result.rows.length });
  } catch (err) {
    console.error('GET /api/custom-views/upcoming error:', err);
    res.status(500).json({ error: 'Failed to load upcoming appointments' });
  }
});

router.post('/dispatch-reminders', async (req, res) => {
  try {
    const { appointmentIds } = req.body || {};
    if (!Array.isArray(appointmentIds) || appointmentIds.length === 0) {
      return res.status(400).json({ error: 'appointmentIds (non-empty array) is required' });
    }

    // Validate IDs are integers
    const ids = appointmentIds
      .map((v) => parseInt(v, 10))
      .filter((v) => Number.isInteger(v) && v > 0);

    if (ids.length === 0) {
      return res.status(400).json({ error: 'No valid appointment IDs provided' });
    }

    // Look up the appointments
    const lookup = await pool.query(
      `SELECT a.id, COALESCE(c.phone, '') AS phone
       FROM appointments a
       LEFT JOIN contacts c ON c.id = a.contact_id
       WHERE a.id = ANY($1::int[])`,
      [ids]
    );

    const sids = [];
    let sent = 0;
    let failed = 0;

    for (const row of lookup.rows) {
      // Simulated SMS dispatch (no live Twilio in this environment)
      if (row.phone && String(row.phone).trim().length > 0) {
        const sid = 'SM' + Math.random().toString(36).slice(2, 14).padEnd(12, '0');
        sids.push(sid);
        sent += 1;
        try {
          await pool.query(
            `UPDATE appointments SET reminder_sent = TRUE WHERE id = $1`,
            [row.id]
          );
        } catch (_) { /* non-fatal */ }
      } else {
        failed += 1;
      }
    }

    // Any IDs not found in DB count as failed
    const foundIds = new Set(lookup.rows.map((r) => r.id));
    for (const id of ids) {
      if (!foundIds.has(id)) failed += 1;
    }

    res.json({ sent, failed, sids });
  } catch (err) {
    console.error('POST /api/custom-views/dispatch-reminders error:', err);
    res.status(500).json({ error: 'Failed to dispatch reminders' });
  }
});

// NON-VIZ 2: APPOINTMENT CONFIRMATION PDF
router.get('/patients', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.id AS appointment_id, a.title, a.start_time, a.end_time, a.location,
              COALESCE(c.id, 0) AS contact_id,
              COALESCE(c.name, 'Unassigned') AS patient_name,
              COALESCE(c.email, '') AS patient_email,
              COALESCE(c.phone, '') AS patient_phone
       FROM appointments a
       LEFT JOIN contacts c ON c.id = a.contact_id
       ORDER BY a.start_time ASC
       LIMIT 100`
    );
    res.json({ patients: result.rows, total: result.rows.length });
  } catch (err) {
    console.error('GET /api/custom-views/patients error:', err);
    res.status(500).json({ error: 'Failed to load patients' });
  }
});

router.get('/confirmation-pdf/:appointmentId', async (req, res) => {
  try {
    const id = parseInt(req.params.appointmentId, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid appointment ID' });
    }

    const lookup = await pool.query(
      `SELECT a.id, a.title, a.description, a.location, a.start_time, a.end_time, a.status,
              COALESCE(c.name, 'Unassigned') AS provider_name,
              COALESCE(c.company, '') AS provider_company,
              COALESCE(c.phone, '') AS provider_phone,
              COALESCE(c.email, '') AS provider_email
       FROM appointments a
       LEFT JOIN contacts c ON c.id = a.contact_id
       WHERE a.id = $1`,
      [id]
    );

    if (lookup.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const appt = lookup.rows[0];
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="confirmation-${id}.pdf"`);
    doc.pipe(res);

    const start = new Date(appt.start_time);
    const end = new Date(appt.end_time);
    const fmt = (d) => isNaN(d.getTime()) ? '—' : d.toLocaleString();

    doc.fontSize(20).fillColor('#1F2937').text('Appointment Confirmation', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#6B7280').text(`Confirmation ID: APPT-${id}`, { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(14).fillColor('#1F2937').text('Appointment Details');
    doc.moveTo(50, doc.y).lineTo(560, doc.y).strokeColor('#E5E7EB').stroke();
    doc.moveDown(0.5);

    doc.fontSize(11).fillColor('#374151');
    doc.text(`Title:       ${appt.title || '—'}`);
    doc.text(`Date/Time:   ${fmt(start)} – ${fmt(end)}`);
    doc.text(`Location:    ${appt.location || '—'}`);
    doc.text(`Status:      ${appt.status || '—'}`);
    doc.moveDown(1);

    doc.fontSize(14).fillColor('#1F2937').text('Provider');
    doc.moveTo(50, doc.y).lineTo(560, doc.y).strokeColor('#E5E7EB').stroke();
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#374151');
    doc.text(`Name:        ${appt.provider_name}`);
    if (appt.provider_company) doc.text(`Practice:    ${appt.provider_company}`);
    if (appt.provider_phone) doc.text(`Phone:       ${appt.provider_phone}`);
    if (appt.provider_email) doc.text(`Email:       ${appt.provider_email}`);
    doc.moveDown(1);

    doc.fontSize(14).fillColor('#1F2937').text('Preparation Instructions');
    doc.moveTo(50, doc.y).lineTo(560, doc.y).strokeColor('#E5E7EB').stroke();
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#374151').text(
      '• Please arrive 10 minutes before your scheduled time.\n' +
      '• Bring a valid photo ID and your insurance card.\n' +
      '• Bring a list of any current medications.\n' +
      '• If you need to cancel or reschedule, please notify us at least 24 hours in advance.\n' +
      '• Wear comfortable clothing appropriate for your appointment type.',
      { lineGap: 4 }
    );
    doc.moveDown(2);

    doc.fontSize(9).fillColor('#9CA3AF').text(
      `Generated ${new Date().toLocaleString()} · AI Appointment Scheduler`,
      { align: 'center' }
    );

    doc.end();
  } catch (err) {
    console.error('GET /api/custom-views/confirmation-pdf error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate PDF' });
    }
  }
});

export default router;
