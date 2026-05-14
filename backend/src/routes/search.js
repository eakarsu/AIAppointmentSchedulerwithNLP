import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../config/database.js';

const router = Router();
router.use(authenticateToken);

// GET /api/search?q=... — unified full-text search across appointments, contacts, categories
router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Query parameter q is required' });
  if (q.length > 200) return res.status(400).json({ error: 'Query too long (max 200 chars)' });

  const search = `%${q}%`;
  const userId = req.user.id;

  try {
    const [appointments, contacts, categories] = await Promise.all([
      pool.query(
        `SELECT id, title, start_time, end_time, location, status, 'appointment' as type
         FROM appointments
         WHERE user_id = $1 AND (title ILIKE $2 OR description ILIKE $2 OR location ILIKE $2)
         ORDER BY start_time DESC LIMIT 10`,
        [userId, search]
      ),
      pool.query(
        `SELECT id, name, email, company, phone, 'contact' as type
         FROM contacts
         WHERE user_id = $1 AND (name ILIKE $2 OR email ILIKE $2 OR company ILIKE $2)
         ORDER BY name LIMIT 10`,
        [userId, search]
      ),
      pool.query(
        `SELECT id, name, color, description, 'category' as type
         FROM categories
         WHERE user_id = $1 AND (name ILIKE $2 OR description ILIKE $2)
         ORDER BY name LIMIT 5`,
        [userId, search]
      ),
    ]);

    const total = appointments.rows.length + contacts.rows.length + categories.rows.length;

    res.json({
      query: q,
      total,
      results: {
        appointments: appointments.rows,
        contacts: contacts.rows,
        categories: categories.rows,
      },
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
