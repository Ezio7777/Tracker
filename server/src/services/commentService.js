const Comment = require('../models/Comment');
const workItemService = require('./workItemService');
const history = require('./historyService');
const notifications = require('./notificationService');
const { pageMeta } = require('../utils/pagination');

// Anyone who can VIEW the work item may comment/read comments (visibility check = 404 otherwise).
async function add(user, workItemId, body) {
  const item = await workItemService.getVisibleDoc(user, workItemId);
  const comment = await Comment.create({ workItem: item._id, author: user._id, body });
  await history.record({ workItem: item._id, actor: user._id, action: 'COMMENTED' });
  await notifications.notify({
    recipients: [item.requester, item.assignee], actor: user, type: 'COMMENTED', entityId: item._id,
    message: `${user.name} commented on "${item.title}"`,
  });
  return comment.populate('author', 'name role');
}

async function list(user, workItemId, { page, limit }) {
  const item = await workItemService.getVisibleDoc(user, workItemId);
  const filter = { workItem: item._id };
  const [data, total] = await Promise.all([
    Comment.find(filter).sort({ createdAt: 1 }).skip((page - 1) * limit).limit(limit).populate('author', 'name role').lean(),
    Comment.countDocuments(filter),
  ]);
  return { data, meta: pageMeta(total, page, limit) };
}

module.exports = { add, list };
