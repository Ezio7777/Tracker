const { query, queryOne } = require('../db/pool');
const { createParams, likePattern } = require('../utils/sql');

// The password hash is never part of this list; it is only read in findByEmailWithHash.
const COLUMNS = 'id, name, email, role, is_active, created_at, updated_at';
const MINIMAL_COLUMNS = 'id, name, email, role';

const findById = (id, db) => queryOne(`SELECT ${COLUMNS} FROM users WHERE id = $1`, [id], db);

const findActiveById = (id, db) => queryOne(`SELECT ${COLUMNS} FROM users WHERE id = $1 AND is_active`, [id], db);

const findByEmailWithHash = (email) =>
  queryOne(`SELECT ${COLUMNS}, password_hash FROM users WHERE email = $1`, [email]);

const emailExists = async (email) => Boolean(await queryOne('SELECT 1 AS found FROM users WHERE email = $1', [email]));

const insert = ({ name, email, passwordHash, role = 'MEMBER' }, db) =>
  queryOne(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING ${COLUMNS}`,
    [name, email, passwordHash, role],
    db
  );

// roles: restrict to a list of roles, role: one exact role, minimal: only the fields a picker needs
async function list({ role, roles, q, isActive, minimal = false, page, limit }) {
  const p = createParams();
  const where = [];
  if (roles) where.push(`role = ANY(${p.add(roles)})`);
  if (role) where.push(`role = ${p.add(role)}`);
  if (isActive !== undefined) where.push(`is_active = ${p.add(isActive)}`);
  if (q) {
    const pattern = p.add(likePattern(q));
    where.push(`(name ILIKE ${pattern} OR email ILIKE ${pattern})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = (await queryOne(`SELECT count(*)::int AS count FROM users ${whereSql}`, p.params)).count;
  const data = await query(
    `SELECT ${minimal ? MINIMAL_COLUMNS : COLUMNS} FROM users ${whereSql}
     ORDER BY name ASC, id ASC LIMIT ${p.add(limit)} OFFSET ${p.add((page - 1) * limit)}`,
    p.params
  );
  return { data, total };
}

const updateRole = (id, role) =>
  queryOne(`UPDATE users SET role = $2 WHERE id = $1 RETURNING ${COLUMNS}`, [id, role]);

const updateActive = (id, isActive) =>
  queryOne(`UPDATE users SET is_active = $2 WHERE id = $1 RETURNING ${COLUMNS}`, [id, isActive]);

// ids of active users with one of the given roles (used to find who should hear about escalations etc.)
const idsByRole = async (roles, db) =>
  (await query('SELECT id FROM users WHERE role = ANY($1) AND is_active', [roles], db)).map((r) => r.id);

module.exports = {
  findById, findActiveById, findByEmailWithHash, emailExists, insert, list, updateRole, updateActive, idsByRole,
};
