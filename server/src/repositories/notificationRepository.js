const { query, queryOne, pool } = require('../db/pool');

// One notification per recipient, all in a single INSERT.
const insertMany = (recipientIds, { type, message, entityId }, db) =>
  query(
    `INSERT INTO notifications (recipient_id, type, message, entity_type, entity_id)
     SELECT r, $2::text, $3::text, 'WORK_ITEM', $4::uuid FROM unnest($1::uuid[]) AS r
     RETURNING *`,
    [recipientIds, type, message, entityId],
    db
  );

// scope "me" lists the user's own notifications; "all" (admin only, checked in the service) lists everyone's.
async function list({ userId, scope, unread, page, limit }) {
  const where = [];
  const params = [];
  if (scope !== 'all') {
    params.push(userId);
    where.push(`n.recipient_id = $${params.length}`);
  }
  if (unread !== undefined) where.push(unread ? 'NOT n.is_read' : 'n.is_read');
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = (await queryOne(`SELECT count(*)::int AS count FROM notifications n ${whereSql}`, params)).count;
  const rows = await query(
    `SELECT n.*, u.name AS recipient_name, u.email AS recipient_email, u.role AS recipient_role
     FROM notifications n JOIN users u ON u.id = n.recipient_id
     ${whereSql}
     ORDER BY n.created_at DESC, n.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, (page - 1) * limit]
  );
  const data = rows.map(({ recipientName, recipientEmail, recipientRole, ...n }) =>
    scope === 'all' ? { ...n, recipient: { id: n.recipientId, name: recipientName, email: recipientEmail, role: recipientRole } } : n
  );
  return { data, total };
}

const countUnread = async (userId) =>
  (await queryOne('SELECT count(*)::int AS count FROM notifications WHERE recipient_id = $1 AND NOT is_read', [userId])).count;

// Only the recipient can mark their own notification as read.
const markRead = (id, userId) =>
  queryOne(
    'UPDATE notifications SET is_read = true, read_at = now() WHERE id = $1 AND recipient_id = $2 RETURNING *',
    [id, userId]
  );

const markAllRead = async (userId) =>
  (await pool.query('UPDATE notifications SET is_read = true, read_at = now() WHERE recipient_id = $1 AND NOT is_read', [userId])).rowCount;

// Housekeeping: keep roughly three months of history.
const deleteOlderThan = async (days) =>
  (await pool.query("DELETE FROM notifications WHERE created_at < now() - ($1 || ' days')::interval", [String(days)])).rowCount;

module.exports = { insertMany, list, countUnread, markRead, markAllRead, deleteOlderThan };
