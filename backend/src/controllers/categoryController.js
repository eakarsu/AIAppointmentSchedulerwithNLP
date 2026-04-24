import pool from '../config/database.js';
import { getPaginationParams, formatPaginatedResponse } from '../utils/pagination.js';

export async function getAllCategories(req, res) {
  try {
    const { page, limit, offset, search, sort, order } = getPaginationParams(req.query);

    const allowedSorts = ['name', 'created_at'];
    const sortColumn = allowedSorts.includes(sort) ? sort : 'name';

    let whereClause = 'WHERE user_id = $1';
    const params = [req.user.id];

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (name ILIKE $${params.length} OR description ILIKE $${params.length})`;
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM categories ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT * FROM categories ${whereClause} ORDER BY ${sortColumn} ${order} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json(formatPaginatedResponse(result.rows, total, page, limit));
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getCategoryById(req, res) {
  try {
    const result = await pool.query('SELECT * FROM categories WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Category not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function createCategory(req, res) {
  const { name, color, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const result = await pool.query(
      `INSERT INTO categories (user_id, name, color, description) VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, name, color || '#3B82F6', description]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function updateCategory(req, res) {
  const { name, color, description } = req.body;
  try {
    const existing = await pool.query('SELECT * FROM categories WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Category not found' });
    const result = await pool.query(
      `UPDATE categories SET name = COALESCE($1, name), color = COALESCE($2, color), description = COALESCE($3, description) WHERE id = $4 AND user_id = $5 RETURNING *`,
      [name, color, description, req.params.id, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteCategory(req, res) {
  try {
    const result = await pool.query('DELETE FROM categories WHERE id = $1 AND user_id = $2 RETURNING *', [req.params.id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Category not found' });
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function bulkDeleteCategories(req, res) {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Array of IDs is required' });
  try {
    const result = await pool.query('DELETE FROM categories WHERE id = ANY($1) AND user_id = $2 RETURNING id', [ids, req.user.id]);
    res.json({ message: `${result.rows.length} categories deleted`, deleted: result.rows.map(r => r.id) });
  } catch (error) {
    console.error('Bulk delete categories error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}
