import pool from '../config/database.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.js';

export async function getAllUsers(req, res) {
  try {
    const { page, limit, offset, search } = getPaginationParams(req.query);
    const params = [];
    let whereClause = '';
    if (search) {
      params.push(`%${search}%`);
      whereClause = `WHERE (name ILIKE $1 OR email ILIKE $1)`;
    }
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM users ${whereClause}`, params
    );
    const total = parseInt(countResult.rows[0].count);
    const result = await pool.query(
      `SELECT id, email, name, role, email_verified, created_at, updated_at FROM users ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json(formatPaginatedResponse(result.rows, total, page, limit));
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteUser(req, res) {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id, email, name',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function updateUserRole(req, res) {
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be "user" or "admin".' });
  }
  try {
    const result = await pool.query(
      'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, email, name, role',
      [role, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'Role updated', user: result.rows[0] });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}
