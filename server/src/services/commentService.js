const commentRepository = require('../repositories/commentRepository');
const historyRepository = require('../repositories/historyRepository');
const workItemService = require('./workItemService');
const notificationService = require('./notificationService');
const ApiError = require('../utils/ApiError');
const { withTransaction } = require('../db/pool');
const { ROLES } = require('../constants/roles');
const { sameId } = require('../utils/ids');
const { pageMeta } = require('../utils/pagination');

// Members can read the comments on items they can see, but may only post on items assigned to or raised by them.
// Managers and admins can comment on anything they can see.
const canComment = (user, item) =>
  user.role !== ROLES.MEMBER || sameId(item.requesterId, user.id) || sameId(item.assigneeId, user.id);

async function add(user, workItemId, body) {
  const item = await workItemService.getVisibleRow(user, workItemId);
  if (!canComment(user, item)) {
    throw ApiError.forbidden('Members can only comment on work items assigned to or raised by them');
  }

  const { comment, pending } = await withTransaction(async (tx) => {
    const created = await commentRepository.insert({ workItemId, authorId: user.id, body }, tx);
    await historyRepository.insert({ workItemId, actorId: user.id, action: 'COMMENTED' }, tx);
    const notes = await notificationService.create({
      recipients: [item.requesterId, item.assigneeId], actor: user, type: 'COMMENTED', entityId: workItemId,
      message: `${user.name} commented on "${item.title}"`,
    }, tx);
    return { comment: created, pending: notes };
  });

  notificationService.deliver(pending);
  return comment;
}

async function list(user, workItemId, { page, limit }) {
  await workItemService.getVisibleRow(user, workItemId);
  const { data, total } = await commentRepository.list(workItemId, { page, limit });
  return { data, meta: pageMeta(total, page, limit) };
}

module.exports = { add, list, canComment };
