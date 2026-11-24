const { query, queryOne } = require('../db/pool');

const toComment = (row) => ({
  id: row.id,
  workItemId: row.workItemId,
  authorId: row.authorId,
  body: row.body,
  createdAt: row.createdAt,
  author: { id: row.authorId, name: row.authorName, role: row.authorRole },
});

// Insert and read back with the author's name in one statement.
async function insert({ workItemId, authorId, body }, db) {
  const row = await queryOne(
    `WITH c AS (
       INSERT INTO comments (work_item_id, author_id, body) VALUES ($1, $2, $3) RETURNING *
     )
     SELECT c.*, u.name AS author_name, u.role AS author_role FROM c JOIN users u ON u.id = c.author_id`,
    [workItemId, authorId, body],
    db
  );
  return toComment(row);
}

async function list(workItemId, { page, limit }) {
  const total = (await queryOne('SELECT count(*)::int AS count FROM comments WHERE work_item_id = $1', [workItemId])).count;
  const rows = await query(
    `SELECT c.*, u.name AS author_name, u.role AS author_role
     FROM comments c JOIN users u ON u.id = c.author_id
     WHERE c.work_item_id = $1
     ORDER BY c.created_at ASC, c.id LIMIT $2 OFFSET $3`,
    [workItemId, limit, (page - 1) * limit]
  );
  return { data: rows.map(toComment), total };
}

module.exports = { insert, list };
