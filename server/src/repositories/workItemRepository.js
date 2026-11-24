const { query, queryOne } = require('../db/pool');
const { createParams, likePattern, buildUpdate } = require('../utils/sql');
const { visibilitySql } = require('../policies/workItemPolicy');
const { CLOSED_LIKE } = require('../constants/statuses');

// A work item together with the people and the project it points to.
const SELECT_DETAILED = `
  SELECT w.id, w.type, w.title, w.description, w.status, w.priority,
         w.project_id, w.requester_id, w.assignee_id,
         w.due_date, w.due_soon_notified_at, w.escalated_at, w.created_at, w.updated_at,
         p.name AS project_name, p.status AS project_status, p.manager_id AS project_manager_id,
         rq.name AS requester_name, rq.email AS requester_email, rq.role AS requester_role,
         a.name AS assignee_name, a.email AS assignee_email, a.role AS assignee_role
  FROM work_items w
  LEFT JOIN projects p ON p.id = w.project_id
  JOIN users rq ON rq.id = w.requester_id
  LEFT JOIN users a ON a.id = w.assignee_id`;

const UPDATABLE = {
  title: 'title',
  description: 'description',
  status: 'status',
  priority: 'priority',
  assigneeId: 'assignee_id',
  dueDate: 'due_date',
  dueSoonNotifiedAt: 'due_soon_notified_at',
  escalatedAt: 'escalated_at',
};

// Priority is stored as text, so sort it by meaning instead of alphabetically.
const PRIORITY_ORDER = `CASE w.priority WHEN 'LOW' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'HIGH' THEN 3 ELSE 4 END`;
const SORT_COLUMNS = {
  createdAt: 'w.created_at',
  updatedAt: 'w.updated_at',
  dueDate: 'w.due_date',
  title: 'lower(w.title)',
  status: 'w.status',
  priority: PRIORITY_ORDER,
};

const person = (row, prefix) =>
  row[`${prefix}Name`] === null || row[`${prefix}Name`] === undefined
    ? null
    : { id: row[`${prefix}Id`], name: row[`${prefix}Name`], email: row[`${prefix}Email`], role: row[`${prefix}Role`] };

function toWorkItem(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    projectId: row.projectId,
    requesterId: row.requesterId,
    assigneeId: row.assigneeId,
    dueDate: row.dueDate,
    escalatedAt: row.escalatedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    project: row.projectId
      ? { id: row.projectId, name: row.projectName, status: row.projectStatus, managerId: row.projectManagerId }
      : null,
    requester: person({ ...row, requesterId: row.requesterId }, 'requester'),
    assignee: person({ ...row, assigneeId: row.assigneeId }, 'assignee'),
  };
}

// The plain row, but only if this user is allowed to see it. forUpdate locks the row inside a transaction.
const findVisible = (user, id, { forUpdate = false } = {}, db) => {
  const p = createParams([id]);
  const visible = visibilitySql(user, p.add);
  return queryOne(
    `SELECT w.* FROM work_items w WHERE w.id = $1 AND ${visible} ${forUpdate ? 'FOR UPDATE OF w' : ''}`,
    p.params,
    db
  );
};

async function findDetailed(id, db) {
  const row = await queryOne(`${SELECT_DETAILED} WHERE w.id = $1`, [id], db);
  return row ? toWorkItem(row) : null;
}

const insert = (item, db) =>
  queryOne(
    `INSERT INTO work_items (type, title, description, status, priority, project_id, requester_id, assignee_id, due_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [item.type, item.title, item.description, item.status, item.priority, item.projectId, item.requesterId, item.assigneeId, item.dueDate],
    db
  );

async function update(id, changes, db) {
  const stmt = buildUpdate('work_items', id, changes, UPDATABLE);
  if (!stmt) return queryOne('SELECT * FROM work_items WHERE id = $1', [id], db);
  return queryOne(stmt.text, stmt.params, db);
}

const softDelete = (id, userId, db) =>
  query('UPDATE work_items SET deleted_at = now(), deleted_by = $2 WHERE id = $1', [id, userId], db);

async function list(user, filters) {
  const p = createParams();
  const where = [visibilitySql(user, p.add)];
  ['status', 'type', 'priority'].forEach((key) => {
    if (filters[key]) where.push(`w.${key} = ${p.add(filters[key])}`);
  });
  if (filters.project) where.push(`w.project_id = ${p.add(filters.project)}`);
  if (filters.assignee) where.push(`w.assignee_id = ${p.add(filters.assignee === 'me' ? user.id : filters.assignee)}`);
  if (filters.requester) where.push(`w.requester_id = ${p.add(filters.requester === 'me' ? user.id : filters.requester)}`);
  if (filters.dueBefore) where.push(`w.due_date <= ${p.add(filters.dueBefore)}`);
  if (filters.q) {
    const pattern = p.add(likePattern(filters.q));
    where.push(`(w.title ILIKE ${pattern} OR w.description ILIKE ${pattern})`);
  }
  const whereSql = where.join(' AND ');

  const direction = filters.order === 'asc' ? 'ASC' : 'DESC';
  const orderBy = `${SORT_COLUMNS[filters.sortBy]} ${direction} NULLS LAST, w.id DESC`; // sortBy is whitelisted by the validator

  const total = (await queryOne(`SELECT count(*)::int AS count FROM work_items w WHERE ${whereSql}`, p.params)).count;
  const rows = await query(
    `${SELECT_DETAILED} WHERE ${whereSql} ORDER BY ${orderBy}
     LIMIT ${p.add(filters.limit)} OFFSET ${p.add((filters.page - 1) * filters.limit)}`,
    p.params
  );
  return { data: rows.map(toWorkItem), total };
}

// Does this person still have unfinished work in the project? (blocks removing them from it)
const hasOpenAssigned = async (projectId, userId) =>
  Boolean(
    await queryOne(
      `SELECT 1 AS found FROM work_items
       WHERE project_id = $1 AND assignee_id = $2 AND deleted_at IS NULL AND NOT (status = ANY($3))
       LIMIT 1`,
      [projectId, userId, CLOSED_LIKE]
    )
  );

// Open items that are due soon and that we have not reminded anyone about yet.
const findDueSoon = (now, horizon) =>
  query(
    `SELECT w.id, w.title, w.assignee_id, w.due_date, p.manager_id AS project_manager_id
     FROM work_items w
     LEFT JOIN projects p ON p.id = w.project_id
     WHERE w.deleted_at IS NULL AND w.assignee_id IS NOT NULL AND w.due_soon_notified_at IS NULL
       AND NOT (w.status = ANY($1)) AND w.due_date > $2 AND w.due_date <= $3`,
    [CLOSED_LIKE, now, horizon]
  );

// Numbers for the dashboard, scoped to what the user may see.
async function summary(user) {
  const run = (extra, extraValue) => {
    const p = createParams();
    const parts = [visibilitySql(user, p.add)];
    if (extra) parts.push(extra(p.add, extraValue));
    return { where: parts.join(' AND '), params: p.params };
  };

  const grouped = run();
  const overdue = run((add) => `NOT (w.status = ANY(${add(CLOSED_LIKE)})) AND w.due_date < now()`);
  const mine = run((add) => `NOT (w.status = ANY(${add(CLOSED_LIKE)})) AND w.assignee_id = ${add(user.id)}`);

  const [groups, overdueRow, mineRow] = await Promise.all([
    query(`SELECT w.type, w.status, count(*)::int AS count FROM work_items w WHERE ${grouped.where} GROUP BY w.type, w.status`, grouped.params),
    queryOne(`SELECT count(*)::int AS count FROM work_items w WHERE ${overdue.where}`, overdue.params),
    queryOne(`SELECT count(*)::int AS count FROM work_items w WHERE ${mine.where}`, mine.params),
  ]);
  return { groups, overdue: overdueRow.count, myOpen: mineRow.count };
}

module.exports = {
  findVisible, findDetailed, insert, update, softDelete, list, hasOpenAssigned, findDueSoon, summary,
};
