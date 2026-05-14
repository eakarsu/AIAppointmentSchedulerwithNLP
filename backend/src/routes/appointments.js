import { Router } from 'express';
import {
  getAllAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  createFromNaturalLanguage,
  getUpcoming,
  bulkDeleteAppointments,
  bulkUpdateAppointments,
  exportAppointmentsCSV
} from '../controllers/appointmentController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import pool from '../config/database.js';

const router = Router();

router.use(authenticateToken);

router.get('/', getAllAppointments);
router.get('/upcoming', getUpcoming);
router.get('/export/csv', exportAppointmentsCSV);

// GET /api/appointments/:id/calendar - returns .ics file
router.get('/:id/calendar', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, c.name as contact_name, c.email as contact_email
       FROM appointments a
       LEFT JOIN contacts c ON a.contact_id = c.id
       WHERE a.id = $1 AND a.user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const apt = result.rows[0];
    const uid = `appointment-${apt.id}@ai-scheduler.app`;

    function toICalDate(dt) {
      return new Date(dt).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    }

    function escapeIcal(str) {
      if (!str) return '';
      return String(str).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    }

    const dtStart = toICalDate(apt.start_time);
    const dtEnd = toICalDate(apt.end_time);
    const now = toICalDate(new Date());

    const descParts = [];
    if (apt.description) descParts.push(apt.description);
    if (apt.contact_name) descParts.push(`With: ${apt.contact_name}`);
    if (apt.status) descParts.push(`Status: ${apt.status}`);
    const description = descParts.join('\\n');

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//AI Appointment Scheduler//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${escapeIcal(apt.title)}`,
      apt.location ? `LOCATION:${escapeIcal(apt.location)}` : '',
      description ? `DESCRIPTION:${description}` : '',
      apt.contact_email ? `ATTENDEE;CN=${escapeIcal(apt.contact_name || apt.contact_email)}:mailto:${apt.contact_email}` : '',
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(line => line !== '').join('\r\n');

    const filename = `appointment-${apt.id}.ics`;
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(ics);
  } catch (error) {
    console.error('Calendar export error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', getAppointmentById);
router.post('/', validate('createAppointment'), createAppointment);
router.post('/nlp', createFromNaturalLanguage);
router.post('/bulk-delete', bulkDeleteAppointments);
router.put('/bulk-update', bulkUpdateAppointments);
router.put('/:id', validate('updateAppointment'), updateAppointment);
router.delete('/:id', deleteAppointment);

export default router;
