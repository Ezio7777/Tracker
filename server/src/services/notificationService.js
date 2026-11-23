const Notification = require('../models/Notification');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../constants/roles');
const { idOf } = require('../utils/ids');
const { pageMeta } = require('../utils/pagination');
const { emitToUser, emitToRole } = require('../sockets');

const userIdsByRole = (roles) => User.find({ role: { $in: roles }, isActive: true }).distinct('_id');

/**
 * Persist first (DB is the source of truth), then push over the socket.
 * De-duplicates recipients and never notifies the actor about their own action.
 */
async function notify({ recipients, actor, type, message, entityId, entityType = 'WORK_ITEM' }) {
  const actorId = actor ? String(idOf(actor)) : null;
  const unique = [...new Set(recipients.filter(Boolean).map((r) => String(idOf(r))))].filter((id) => id !== actorId);
  if (!unique.length) return [];

  const docs = await Notification.insertMany(
    unique.map((recipient) => ({ recipient, type, message, entityType, entityId }))
  );
  docs.forEach((doc) => {
    const payload = doc.toJSON();
    emitToUser(String(doc.recipient), 'notification:new', payload);
    emitToRole(ROLES.ADMIN, 'notification:audit', payload); // admins can watch the whole system
  });
  return docs;
}

// Who hears about a brand-new ticket: the project's owner, or all staff for the triage queue.
async function ticketCreatedRecipients(project) {
  if (project) return [project.owner];
  return userIdsByRole([ROLES.ADMIN, ROLES.MANAGER]);
}

// Escalations: project owner + admins, or all staff for project-less tickets.
async function escalationRecipients(project) {
  if (project) return [project.owner, ...(await userIdsByRole([ROLES.ADMIN]))];
  return userIdsByRole([ROLES.ADMIN, ROLES.MANAGER]);
}

async function list(user, { unread, scope, page, limit }) {
  if (scope === 'all' && user.role !== ROLES.ADMIN) throw ApiError.forbidden('Only admins can view all notifications');
  const filter = scope === 'all' ? {} : { recipient: user._id };
  if (unread !== undefined) filter.isRead = !unread;

  let query = Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
  if (scope === 'all') query = query.populate('recipient', 'name email role');
  const [data, total, unreadCount] = await Promise.all([
    query.lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: user._id, isRead: false }),
  ]);
  return { data, meta: { ...pageMeta(total, page, limit), unreadCount } };
}

// Only the recipient can mark a notification read (admins viewing "all" cannot).
async function markRead(user, id) {
  const doc = await Notification.findOneAndUpdate(
    { _id: id, recipient: user._id },
    { isRead: true, readAt: new Date() },
    { new: true }
  );
  if (!doc) throw ApiError.notFound('Notification not found');
  return doc;
}

async function markAllRead(user) {
  const res = await Notification.updateMany({ recipient: user._id, isRead: false }, { isRead: true, readAt: new Date() });
  return { modified: res.modifiedCount };
}

const unreadCount = (user) => Notification.countDocuments({ recipient: user._id, isRead: false });

module.exports = {
  notify, ticketCreatedRecipients, escalationRecipients, list, markRead, markAllRead, unreadCount,
};
