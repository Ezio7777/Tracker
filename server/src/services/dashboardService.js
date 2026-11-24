const workItemRepository = require('../repositories/workItemRepository');
const notificationService = require('./notificationService');

// Same visibility rules as GET /work-items, so the numbers never include anything the user cannot open.
async function summary(user) {
  const [{ groups, overdue, myOpen }, unread] = await Promise.all([
    workItemRepository.summary(user),
    notificationService.unreadCount(user),
  ]);

  const byStatus = {};
  const byType = { TASK: 0, TICKET: 0 };
  groups.forEach(({ type, status, count }) => {
    byStatus[status] = (byStatus[status] || 0) + count;
    byType[type] += count;
  });
  return { total: byType.TASK + byType.TICKET, byType, byStatus, overdue, myOpen, unreadNotifications: unread };
}

module.exports = { summary };
