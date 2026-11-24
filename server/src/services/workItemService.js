const workItemRepository = require('../repositories/workItemRepository');
const projectRepository = require('../repositories/projectRepository');
const userRepository = require('../repositories/userRepository');
const historyRepository = require('../repositories/historyRepository');
const notificationService = require('./notificationService');
const ApiError = require('../utils/ApiError');
const { withTransaction } = require('../db/pool');
const { ROLES } = require('../constants/roles');
const { INITIAL_STATUS, TERMINAL_STATUSES, canTransition, allowedTransitions } = require('../constants/statuses');
const { getUpdateScope, FULL_FIELDS, ASSIGNEE_FIELDS } = require('../policies/workItemPolicy');
const { canAccessProject, canManageProject } = require('../policies/projectPolicy');
const { sameId } = require('../utils/ids');
const { pageMeta } = require('../utils/pagination');

/* ------------------------------------------------------------------ helpers */

// Loads an item only if the caller may see it. Anything else looks like a 404, so ids cannot be probed.
async function getVisibleRow(user, id, options, db) {
  const row = await workItemRepository.findVisible(user, id, options, db);
  if (!row) throw ApiError.notFound('Work item not found');
  return row;
}

// Rule: an assignee must belong to the project (its manager counts), or for a ticket without a project
// must be a manager or admin.
async function assertAssignable(assigneeId, project, db) {
  const assignee = await userRepository.findActiveById(assigneeId, db);
  if (!assignee) throw ApiError.badRequest('Assignee not found or inactive');
  if (project) {
    const eligible = project.managerId === assignee.id || project.members.some((m) => m.id === assignee.id);
    if (!eligible) throw ApiError.badRequest('Assignee must be a member of the project');
  } else if (![ROLES.ADMIN, ROLES.MANAGER].includes(assignee.role)) {
    throw ApiError.badRequest('Tickets without a project can only be assigned to a manager or admin');
  }
  return assignee;
}

// Checks a status change against the allowed transitions and describes what to write.
function planStatusChange(item, to, privileged) {
  const check = canTransition(item.type, item.status, to, privileged);
  if (!check.ok) throw new ApiError(422, check.reason, { allowed: check.allowed });
  const escalating = to === 'ESCALATED';
  return {
    changes: { status: to, ...(escalating ? { escalatedAt: new Date() } : {}) },
    event: { action: escalating ? 'ESCALATED' : 'STATUS_CHANGED', from: item.status, to },
  };
}

// Writes the activity log and creates the notifications for a list of change events.
// Returns the notifications so the caller can push them over the socket once the transaction has committed.
async function recordEvents(tx, item, project, actor, events) {
  const label = `"${item.title}"`;
  const pending = [];
  for (const e of events) {
    await historyRepository.insert({ workItemId: item.id, actorId: actor.id, ...e }, tx);
    const base = { actor, entityId: item.id };

    if (e.action === 'ASSIGNED' && e.to) {
      pending.push(...(await notificationService.create(
        { ...base, recipients: [e.to], type: 'ASSIGNED', message: `${actor.name} assigned you ${label}` }, tx)));
    } else if (e.action === 'STATUS_CHANGED') {
      pending.push(...(await notificationService.create(
        { ...base, recipients: [item.requesterId, item.assigneeId], type: 'STATUS_CHANGED',
          message: `${actor.name} moved ${label} from ${e.from} to ${e.to}` }, tx)));
    } else if (e.action === 'ESCALATED') {
      const staff = await notificationService.escalationRecipients(project, tx);
      pending.push(...(await notificationService.create(
        { ...base, recipients: [item.requesterId, item.assigneeId, ...staff], type: 'ESCALATED',
          message: `${actor.name} escalated ticket ${label}` }, tx)));
    }
  }
  return pending;
}

/* ------------------------------------------------------------------- create */

async function create(user, data) {
  const { type } = data;
  let project = null;
  if (data.project) {
    project = await projectRepository.findById(data.project);
    if (!project) throw ApiError.notFound('Project not found');
  }

  if (type === 'TASK' && !canManageProject(user, project)) {
    throw ApiError.forbidden('Only the project manager or an admin can create tasks');
  }
  if (type === 'TICKET' && project && !canAccessProject(user, project)) {
    throw ApiError.notFound('Project not found'); // do not reveal projects the user cannot see
  }
  if (project && project.status === 'ARCHIVED') throw ApiError.conflict('This project is archived');

  const isStaff = user.role === ROLES.ADMIN || (user.role === ROLES.MANAGER && (!project || canManageProject(user, project)));
  if (!isStaff && (data.assignee || data.dueDate)) {
    throw ApiError.forbidden('Only managers and admins can set an assignee or due date');
  }

  const { id, pending } = await withTransaction(async (tx) => {
    if (data.assignee) await assertAssignable(data.assignee, project, tx);

    const item = await workItemRepository.insert({
      type,
      title: data.title,
      description: data.description,
      priority: data.priority || 'MEDIUM',
      status: INITIAL_STATUS[type],
      projectId: project ? project.id : null,
      requesterId: user.id,
      assigneeId: data.assignee || null,
      dueDate: data.dueDate || null,
    }, tx);

    await historyRepository.insert({ workItemId: item.id, actorId: user.id, action: 'CREATED', to: item.status }, tx);
    const events = item.assigneeId ? [{ action: 'ASSIGNED', to: item.assigneeId }] : [];
    const notes = await recordEvents(tx, item, project, user, events);

    if (type === 'TICKET') {
      const recipients = await notificationService.ticketCreatedRecipients(project, tx);
      notes.push(...(await notificationService.create({
        recipients, actor: user, type: 'TICKET_CREATED', entityId: item.id,
        message: `${user.name} raised a new ticket "${item.title}"`,
      }, tx)));
    }
    return { id: item.id, pending: notes };
  });

  notificationService.deliver(pending);
  return workItemRepository.findDetailed(id);
}

/* --------------------------------------------------------------------- read */

async function list(user, filters) {
  const { data, total } = await workItemRepository.list(user, filters);
  return { data, meta: pageMeta(total, filters.page, filters.limit) };
}

// Returns the item plus what the caller may do with it, so the UI never has to re-implement the rules.
async function getById(user, id) {
  await getVisibleRow(user, id);
  const item = await workItemRepository.findDetailed(id);
  const scope = getUpdateScope(user, item, item.project);
  const involved = sameId(item.requesterId, user.id) || sameId(item.assigneeId, user.id);
  const privileged = scope === 'FULL';
  const locked = TERMINAL_STATUSES.includes(item.status);

  return {
    ...item,
    permissions: {
      editScope: locked ? null : scope,
      editableFields: locked ? [] : scope === 'FULL' ? FULL_FIELDS : scope === 'ASSIGNEE' ? ASSIGNEE_FIELDS : [],
      allowedNextStatuses: scope && !locked ? allowedTransitions(item.type, item.status, privileged) : [],
      canEscalate: item.type === 'TICKET' && !locked && (!!scope || involved) &&
        canTransition('TICKET', item.status, 'ESCALATED', privileged).ok,
      canDelete: user.role === ROLES.ADMIN,
      canComment: user.role !== ROLES.MEMBER || involved,
    },
  };
}

async function getHistory(user, id) {
  await getVisibleRow(user, id);
  return historyRepository.listForWorkItem(id);
}

/* ------------------------------------------------------------------- update */

async function update(user, id, body) {
  const { pending } = await withTransaction(async (tx) => {
    // FOR UPDATE: two people changing the same item at the same moment are handled one after the other.
    const item = await getVisibleRow(user, id, { forUpdate: true }, tx);
    const project = item.projectId ? await projectRepository.findById(item.projectId, tx) : null;

    const scope = getUpdateScope(user, item, project);
    if (!scope) throw ApiError.forbidden('You cannot modify this work item');

    const allowed = scope === 'FULL' ? FULL_FIELDS : ASSIGNEE_FIELDS;
    const denied = Object.keys(body).filter((k) => !allowed.includes(k));
    if (denied.length) throw ApiError.forbidden(`You are not allowed to change: ${denied.join(', ')}`);
    if (TERMINAL_STATUSES.includes(item.status)) {
      throw ApiError.conflict(`This item is ${item.status} and can no longer be modified`);
    }

    const changes = {};
    const events = [];

    if (body.status && body.status !== item.status) {
      const plan = planStatusChange(item, body.status, scope === 'FULL');
      Object.assign(changes, plan.changes);
      events.push(plan.event);
    }
    if ('assignee' in body && !sameId(body.assignee, item.assigneeId)) {
      if (body.assignee) await assertAssignable(body.assignee, project, tx);
      events.push({ action: 'ASSIGNED', from: item.assigneeId, to: body.assignee || null });
      changes.assigneeId = body.assignee || null;
      changes.dueSoonNotifiedAt = null; // the new assignee should get their own reminder
    }
    if (body.priority && body.priority !== item.priority) {
      events.push({ action: 'PRIORITY_CHANGED', from: item.priority, to: body.priority });
      changes.priority = body.priority;
    }
    if ('dueDate' in body) {
      const before = item.dueDate ? item.dueDate.getTime() : null;
      const after = body.dueDate ? body.dueDate.getTime() : null;
      if (before !== after) {
        events.push({ action: 'UPDATED', from: item.dueDate, to: body.dueDate, meta: { field: 'dueDate' } });
        changes.dueDate = body.dueDate || null;
        changes.dueSoonNotifiedAt = null;
      }
    }
    ['title', 'description'].forEach((field) => {
      if (field in body && body[field] !== item[field]) {
        events.push({ action: 'UPDATED', meta: { field } });
        changes[field] = body[field];
      }
    });

    if (!events.length) return { pending: [] }; // nothing actually changed
    const updated = await workItemRepository.update(id, changes, tx);
    return { pending: await recordEvents(tx, updated, project, user, events) };
  });

  notificationService.deliver(pending);
  return workItemRepository.findDetailed(id);
}

async function escalate(user, id) {
  const { pending } = await withTransaction(async (tx) => {
    const item = await getVisibleRow(user, id, { forUpdate: true }, tx);
    if (item.type !== 'TICKET') throw ApiError.badRequest('Only tickets can be escalated');
    const project = item.projectId ? await projectRepository.findById(item.projectId, tx) : null;

    const scope = getUpdateScope(user, item, project);
    const involved = sameId(item.requesterId, user.id) || sameId(item.assigneeId, user.id);
    if (!scope && !involved) throw ApiError.forbidden('Only the requester, the assignee or a manager can escalate this ticket');

    const plan = planStatusChange(item, 'ESCALATED', scope === 'FULL');
    const updated = await workItemRepository.update(id, plan.changes, tx);
    return { pending: await recordEvents(tx, updated, project, user, [plan.event]) };
  });

  notificationService.deliver(pending);
  return workItemRepository.findDetailed(id);
}

/* ------------------------------------------------------------------- delete */

// Soft delete: the row stays (history and comments keep pointing at it) but disappears from every query.
async function remove(user, id) {
  if (user.role !== ROLES.ADMIN) throw ApiError.forbidden('Only admins can delete work items');
  await withTransaction(async (tx) => {
    await getVisibleRow(user, id, { forUpdate: true }, tx);
    await workItemRepository.softDelete(id, user.id, tx);
    await historyRepository.insert({ workItemId: id, actorId: user.id, action: 'DELETED' }, tx);
  });
}

module.exports = { create, list, getById, getHistory, update, escalate, remove, getVisibleRow };
