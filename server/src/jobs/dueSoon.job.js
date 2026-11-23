const cron = require('node-cron');
const env = require('../config/env');
const WorkItem = require('../models/WorkItem');
const Project = require('../models/Project');
const notifications = require('../services/notificationService');
const { CLOSED_LIKE } = require('../constants/statuses');

// Notifies assignee + project owner once per due date when an open item is due within DUE_SOON_HOURS.
async function runDueSoon(now = new Date()) {
  const horizon = new Date(now.getTime() + env.dueSoonHours * 3600000);
  const items = await WorkItem.find({
    deletedAt: null,
    assignee: { $ne: null },
    dueSoonNotifiedAt: null,
    status: { $nin: CLOSED_LIKE },
    dueDate: { $gt: now, $lte: horizon },
  });

  for (const item of items) {
    const project = item.project ? await Project.findById(item.project).select('owner') : null;
    await notifications.notify({
      recipients: [item.assignee, project && project.owner],
      type: 'DUE_SOON',
      entityId: item._id,
      message: `"${item.title}" is due ${item.dueDate.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    });
    item.dueSoonNotifiedAt = now;
    await item.save();
  }
  return items.length;
}

function startDueSoonJob() {
  cron.schedule('*/15 * * * *', () => runDueSoon().catch((e) => console.error('dueSoon job failed', e)));
}

module.exports = { runDueSoon, startDueSoonJob };
