import bcrypt from 'bcryptjs';
import pool from '../config/database.js';

const email = String(process.env.PROVISION_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.PROVISION_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
const name = String(process.env.PROVISION_ADMIN_NAME || 'Initial Administrator').trim();
const tenantId = String(process.env.DEFAULT_TENANT_ID || process.env.GOVERNANCE_TENANT_ID || '').trim();

if (!email.includes('@') || typeof password !== 'string' || password.length < 12 || !tenantId) {
  throw new Error('A valid administrator email, password of at least 12 characters, and tenant ID are required');
}

const passwordHash = await bcrypt.hash(password, 12);
await pool.query(
  `INSERT INTO users (email, password, name, role, tenant_id)
   VALUES ($1, $2, $3, 'admin', $4)
   ON CONFLICT (email) DO UPDATE
     SET password = EXCLUDED.password,
         name = EXCLUDED.name,
         role = 'admin',
         tenant_id = EXCLUDED.tenant_id`,
  [email, passwordHash, name, tenantId],
);
await pool.end();
