const notificationRepository = require('../repositories/notificationRepository');
const userRepository = require('../repositories/userRepository');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../constants/roles');
const { idOf } = require('../utils/ids');
const { pageMeta } = require('../utils/pagination');
const { emitToUser, emitToRole } = require('../sockets');

/**
 * Notifications are written to the database first (inside the caller's transaction when there is one).
 * Sending them over the socket is a separate step, deliver(), that the caller runs AFTER the transaction
 * committed, so nobody is told about something that was rolled back.
 */
async function create({ recipients, actor, type, message, entityId }, db) {
  const actorId = actor ? idOf(actor) : null;
  const unique = [...new Set(recipients.filter(Boolean).map(idOf))].filter((id) => id !== actorId); // never notify yourself
  if (!unique.length) return [];
  return notificationRepository.insertMany(unique, { type, message, entityId }, db);
}

function deliver(notifications) {
  notifications.forEach((n) => {
    emitToUser(n.recipientId, 'notification:new', n);
    emitToRole(ROLES.ADMIN, 'notification:audit', n); // admins can watch the whole system
  });
}

// For callers that are not inside a transaction (comments, the due-soon job).
async function createAndDeliver(args) {
  const created = await create(args);
  deliver(created);
  return created;
}

// Who hears about a brand new ticket: the project's manager, or all managers and admins for a general ticket.
async function ticketCreatedRecipients(project, db) {
  if (project) return [project.managerId];
  return userRepository.idsByRole([ROLES.ADMIN, ROLES.MANAGER], db);
}

// Escalations go to the project's manager and the admins, or to all managers and admins for a general ticket.
async function escalationRecipients(project, db) {
  if (project) return [project.managerId, ...(await userRepository.idsByRole([ROLES.ADMIN], db))];
  return userRepository.idsByRole([ROLES.ADMIN, ROLES.MANAGER], db);
}

async function list(user, { unread, scope, page, limit }) {
  if (scope === 'all' && user.role !== ROLES.ADMIN) throw ApiError.forbidden('Only admins can view all notifications');
  const [{ data, total }, unreadCount] = await Promise.all([
    notificationRepository.list({ userId: user.id, scope, unread, page, limit }),
    notificationRepository.countUnread(user.id),
  ]);
  return { data, meta: { ...pageMeta(total, page, limit), unreadCount } };
}

// Marking someone else's notification as read finds nothing, so it looks like a 404.
async function markRead(user, id) {
  const notification = await notificationRepository.markRead(id, user.id);
  if (!notification) throw ApiError.notFound('Notification not found');
  return notification;
}

const markAllRead = async (user) => ({ modified: await notificationRepository.markAllRead(user.id) });

const unreadCount = (user) => notificationRepository.countUnread(user.id);

module.exports = {
  create, deliver, createAndDeliver, ticketCreatedRecipients, escalationRecipients, list, markRead, markAllRead, unreadCount,
};
