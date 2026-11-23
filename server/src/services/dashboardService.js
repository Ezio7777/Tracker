const WorkItem = require('../models/WorkItem');
const { buildVisibilityFilter } = require('../policies/workItemPolicy');
const { CLOSED_LIKE } = require('../constants/statuses');
const notificationService = require('./notificationService');

// Everything is scoped by the same visibility filter as GET /work-items.
async function summary(user) {
  const visible = await buildVisibilityFilter(user);
  const now = new Date();
  const open = { status: { $nin: CLOSED_LIKE } };

  const [grouped, overdue, myOpen, unread] = await Promise.all([
    WorkItem.aggregate([{ $match: visible }, { $group: { _id: { type: '$type', status: '$status' }, count: { $sum: 1 } } }]),
    WorkItem.countDocuments({ ...visible, ...open, dueDate: { $lt: now } }),
    WorkItem.countDocuments({ ...visible, ...open, assignee: user._id }),
    notificationService.unreadCount(user),
  ]);

  const byStatus = {};
  const byType = { TASK: 0, TICKET: 0 };
  grouped.forEach(({ _id, count }) => {
    byStatus[_id.status] = (byStatus[_id.status] || 0) + count;
    byType[_id.type] += count;
  });
  return { total: byType.TASK + byType.TICKET, byType, byStatus, overdue, myOpen, unreadNotifications: unread };
}

module.exports = { summary };
