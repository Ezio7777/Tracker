const cron = require('node-cron');
const env = require('../config/env');
const workItemRepository = require('../repositories/workItemRepository');
const notificationService = require('../services/notificationService');

// Reminds the assignee and the project manager once per due date when an open item is due within DUE_SOON_HOURS.
async function runDueSoon(now = new Date()) {
  const horizon = new Date(now.getTime() + env.dueSoonHours * 3600000);
  const items = await workItemRepository.findDueSoon(now, horizon);

  for (const item of items) {
    await notificationService.createAndDeliver({
      recipients: [item.assigneeId, item.projectManagerId],
      type: 'DUE_SOON',
      entityId: item.id,
      message: `"${item.title}" is due ${item.dueDate.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    });
    await workItemRepository.update(item.id, { dueSoonNotifiedAt: now });
  }
  return items.length;
}

function startDueSoonJob() {
  cron.schedule('*/15 * * * *', () => runDueSoon().catch((err) => console.error('due-soon job failed', err)));
}

module.exports = { runDueSoon, startDueSoonJob };
