const { query } = require('../db/pool');

// Ids, dates and plain values are all stored as text, which keeps the activity log simple to read.
const asText = (v) => (v === null || v === undefined ? null : v instanceof Date ? v.toISOString() : String(v));

const insert = ({ workItemId, actorId, action, from = null, to = null, meta = null }, db) =>
  query(
    `INSERT INTO work_item_history (work_item_id, actor_id, action, from_value, to_value, meta)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [workItemId, actorId, action, asText(from), asText(to), meta ? JSON.stringify(meta) : null],
    db
  );

async function listForWorkItem(workItemId) {
  const rows = await query(
    `SELECT h.id, h.action, h.from_value, h.to_value, h.meta, h.created_at, h.actor_id, u.name AS actor_name, u.role AS actor_role
     FROM work_item_history h JOIN users u ON u.id = h.actor_id
     WHERE h.work_item_id = $1
     ORDER BY h.created_at ASC, h.id`,
    [workItemId]
  );
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    from: r.fromValue,
    to: r.toValue,
    meta: r.meta,
    createdAt: r.createdAt,
    actor: { id: r.actorId, name: r.actorName, role: r.actorRole },
  }));
}

module.exports = { insert, listForWorkItem };
