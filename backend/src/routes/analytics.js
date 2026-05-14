import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../config/database.js';

const router = Router();
router.use(authenticateToken);

// GET /api/analytics/appointments
// Returns: appointments by hour-of-day, most popular types, no-show/cancellation rate by day-of-week, avg lead time
router.get('/appointments', async (req, res) => {
  try {
    const userId = req.user.id;

    const [byHour, byStatus, byDayOfWeek, leadTime] = await Promise.all([
      // Appointments by hour of day (heat map data)
      pool.query(`
        SELECT EXTRACT(HOUR FROM start_time)::int AS hour_of_day, COUNT(*) AS count
        FROM appointments
        WHERE user_id = $1
        GROUP BY hour_of_day
        ORDER BY hour_of_day
      `, [userId]),

      // Most popular appointment types (by title keywords)
      pool.query(`
        SELECT title, COUNT(*) AS count
        FROM appointments
        WHERE user_id = $1
        GROUP BY title
        ORDER BY count DESC
        LIMIT 10
      `, [userId]),

      // No-show / cancellation rate by day of week
      pool.query(`
        SELECT
          TO_CHAR(start_time, 'Day') AS day_of_week,
          EXTRACT(DOW FROM start_time)::int AS day_number,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status IN ('no-show', 'no_show', 'noshow')) AS no_shows,
          COUNT(*) FILTER (WHERE status = 'cancelled') AS cancellations
        FROM appointments
        WHERE user_id = $1
        GROUP BY day_of_week, day_number
        ORDER BY day_number
      `, [userId]),

      // Average lead time: booking_date (created_at) to appointment start_time
      pool.query(`
        SELECT
          AVG(EXTRACT(DAY FROM (start_time - created_at))) AS avg_lead_time_days,
          MIN(EXTRACT(DAY FROM (start_time - created_at))) AS min_lead_time_days,
          MAX(EXTRACT(DAY FROM (start_time - created_at))) AS max_lead_time_days,
          COUNT(*) AS total_appointments
        FROM appointments
        WHERE user_id = $1 AND start_time > created_at
      `, [userId]),
    ]);

    // Build hour-of-day heat map (fill in missing hours with 0)
    const hourMap = {};
    byHour.rows.forEach(r => { hourMap[r.hour_of_day] = parseInt(r.count); });
    const hourHeatMap = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      label: `${String(h).padStart(2, '0')}:00`,
      count: hourMap[h] || 0,
    }));

    // Day-of-week rates
    const dayOfWeekStats = byDayOfWeek.rows.map(r => ({
      day: r.day_of_week.trim(),
      day_number: r.day_number,
      total: parseInt(r.total),
      no_shows: parseInt(r.no_shows),
      cancellations: parseInt(r.cancellations),
      no_show_rate: r.total > 0 ? ((r.no_shows / r.total) * 100).toFixed(1) + '%' : '0%',
      cancellation_rate: r.total > 0 ? ((r.cancellations / r.total) * 100).toFixed(1) + '%' : '0%',
    }));

    const lt = leadTime.rows[0];

    res.json({
      appointments_by_hour: hourHeatMap,
      most_popular_types: byStatus.rows.map(r => ({ title: r.title, count: parseInt(r.count) })),
      no_show_cancellation_by_day: dayOfWeekStats,
      lead_time: {
        avg_days: lt.avg_lead_time_days != null ? parseFloat(Number(lt.avg_lead_time_days).toFixed(1)) : null,
        min_days: lt.min_lead_time_days != null ? parseFloat(Number(lt.min_lead_time_days).toFixed(1)) : null,
        max_days: lt.max_lead_time_days != null ? parseFloat(Number(lt.max_lead_time_days).toFixed(1)) : null,
        total_appointments: parseInt(lt.total_appointments) || 0,
      },
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
