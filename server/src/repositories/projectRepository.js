const { query, queryOne } = require('../db/pool');
const { createParams, likePattern, buildUpdate } = require('../utils/sql');

const SELECT_PROJECT = `
  SELECT p.id, p.name, p.description, p.status, p.manager_id, p.created_at, p.updated_at,
         m.name AS manager_name, m.email AS manager_email, m.role AS manager_role
  FROM projects p
  JOIN users m ON m.id = p.manager_id`;

const UPDATABLE = { name: 'name', description: 'description', status: 'status' };

// One query for the members of many projects, so list pages do not run a query per project.
async function loadMembers(projectIds, db) {
  const byProject = new Map();
  if (!projectIds.length) return byProject;
  const rows = await query(
    `SELECT pm.project_id, u.id, u.name, u.email, u.role
     FROM project_members pm
     JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = ANY($1)
     ORDER BY u.name`,
    [projectIds],
    db
  );
  rows.forEach(({ projectId, ...member }) => {
    if (!byProject.has(projectId)) byProject.set(projectId, []);
    byProject.get(projectId).push(member);
  });
  return byProject;
}

const toProject = (row, members = []) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  status: row.status,
  managerId: row.managerId,
  manager: { id: row.managerId, name: row.managerName, email: row.managerEmail, role: row.managerRole },
  members,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

async function findById(id, db) {
  const row = await queryOne(`${SELECT_PROJECT} WHERE p.id = $1`, [id], db);
  if (!row) return null;
  const members = await loadMembers([id], db);
  return toProject(row, members.get(id));
}

async function insert({ name, description, managerId }, db) {
  const row = await queryOne(
    'INSERT INTO projects (name, description, manager_id) VALUES ($1, $2, $3) RETURNING id',
    [name, description, managerId],
    db
  );
  return findById(row.id, db);
}

async function update(id, changes, db) {
  const stmt = buildUpdate('projects', id, changes, UPDATABLE);
  if (stmt) await query(stmt.text, stmt.params, db);
  return findById(id, db);
}

// Admins see everything, managers see projects they manage or belong to, members see projects they belong to.
async function list({ user, status, q, page, limit }) {
  const p = createParams();
  const where = [];
  if (user.role !== 'ADMIN') {
    const me = p.add(user.id);
    const isMember = `EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = ${me})`;
    where.push(user.role === 'MANAGER' ? `(p.manager_id = ${me} OR ${isMember})` : isMember);
  }
  if (status) where.push(`p.status = ${p.add(status)}`);
  if (q) where.push(`p.name ILIKE ${p.add(likePattern(q))}`);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = (await queryOne(`SELECT count(*)::int AS count FROM projects p ${whereSql}`, p.params)).count;
  const rows = await query(
    `${SELECT_PROJECT} ${whereSql} ORDER BY p.created_at DESC, p.id LIMIT ${p.add(limit)} OFFSET ${p.add((page - 1) * limit)}`,
    p.params
  );
  const members = await loadMembers(rows.map((r) => r.id));
  return { data: rows.map((r) => toProject(r, members.get(r.id))), total };
}

// Adding someone twice is not an error, it just does nothing.
const addMember = (projectId, userId) =>
  query('INSERT INTO project_members (project_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [projectId, userId]);

const removeMember = (projectId, userId) =>
  query('DELETE FROM project_members WHERE project_id = $1 AND user_id = $2', [projectId, userId]);

module.exports = { findById, insert, update, list, addMember, removeMember };
