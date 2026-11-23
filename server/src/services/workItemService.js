const WorkItem = require('../models/WorkItem');
const Project = require('../models/Project');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../constants/roles');
const { INITIAL_STATUS, TERMINAL_STATUSES, canTransition, allowedTransitions } = require('../constants/statuses');
const { buildVisibilityFilter, getUpdateScope, FULL_FIELDS, ASSIGNEE_FIELDS } = require('../policies/workItemPolicy');
const { canAccessProject, canManageProject } = require('../policies/projectPolicy');
const { sameId } = require('../utils/ids');
const { pageMeta, escapeRegex } = require('../utils/pagination');
const history = require('./historyService');
const notifications = require('./notificationService');

const POPULATE = [
  { path: 'project', select: 'name status owner' },
  { path: 'requester', select: 'name email role' },
  { path: 'assignee', select: 'name email role' },
];
const SORT_MAP = {
  createdAt: 'createdAt', updatedAt: 'updatedAt', dueDate: 'dueDate',
  title: 'title', status: 'status', priority: 'priorityRank',
};

/* ---------- helpers ---------- */

// Visibility is enforced in the query itself; invisible items look like they don't exist (404).
async function getVisibleDoc(user, id) {
  const filter = await buildVisibilityFilter(user);
  const item = await WorkItem.findOne({ $and: [{ _id: id }, filter] });
  if (!item) throw ApiError.notFound('Work item not found');
  return item;
}

async function assertAssignable(assigneeId, project) {
  const assignee = await User.findOne({ _id: assigneeId, isActive: true });
  if (!assignee) throw ApiError.badRequest('Assignee not found or inactive');
  if (project) {
    const eligible = sameId(project.owner, assignee._id) || project.members.some((m) => sameId(m, assignee._id));
    if (!eligible) throw ApiError.badRequest('Assignee must be a member of the project');
  } else if (![ROLES.ADMIN, ROLES.MANAGER].includes(assignee.role)) {
    throw ApiError.badRequest('Project-less tickets can only be assigned to a manager or admin');
  }
  return assignee;
}

// Mutates the item (does not save) and returns the history event describing the change.
function moveStatus(item, to, privileged) {
  const check = canTransition(item.type, item.status, to, privileged);
  if (!check.ok) throw new ApiError(422, check.reason, { allowed: check.allowed });
  const from = item.status;
  item.status = to;
  if (to === 'ESCALATED') item.escalatedAt = new Date();
  return { action: to === 'ESCALATED' ? 'ESCALATED' : 'STATUS_CHANGED', from, to };
}

// Records history and fans out notifications for each change event.
async function publish(item, project, actor, events) {
  const label = `"${item.title}"`;
  for (const e of events) {
    await history.record({ workItem: item._id, actor: actor._id, ...e });
    const base = { actor, entityId: item._id };
    if (e.action === 'ASSIGNED' && e.to) {
      await notifications.notify({ ...base, recipients: [e.to], type: 'ASSIGNED', message: `${actor.name} assigned you ${label}` });
    } else if (e.action === 'STATUS_CHANGED') {
      await notifications.notify({
        ...base, recipients: [item.requester, item.assignee], type: 'STATUS_CHANGED',
        message: `${actor.name} moved ${label} from ${e.from} to ${e.to}`,
      });
    } else if (e.action === 'ESCALATED') {
      const staff = await notifications.escalationRecipients(project);
      await notifications.notify({
        ...base, recipients: [item.requester, item.assignee, ...staff], type: 'ESCALATED',
        message: `${actor.name} escalated ticket ${label}`,
      });
    }
  }
}

const populated = (item) => item.populate(POPULATE);

/* ---------- create ---------- */

async function create(user, data) {
  const { type } = data;
  let project = null;
  if (data.project) {
    project = await Project.findById(data.project);
    if (!project) throw ApiError.notFound('Project not found');
  }

  if (type === 'TASK' && !canManageProject(user, project)) {
    throw ApiError.forbidden('Only the project owner or an admin can create tasks');
  }
  if (type === 'TICKET' && project && !canAccessProject(user, project)) {
    throw ApiError.notFound('Project not found'); // do not reveal projects the user can't see
  }
  if (project && project.status === 'ARCHIVED') throw ApiError.conflict('This project is archived');

  const isStaff = user.role === ROLES.ADMIN || (user.role === ROLES.MANAGER && (!project || canManageProject(user, project)));
  if (!isStaff && (data.assignee || data.dueDate)) {
    throw ApiError.forbidden('Only managers and admins can set an assignee or due date');
  }
  if (data.assignee) await assertAssignable(data.assignee, project);

  const item = await WorkItem.create({
    type,
    title: data.title,
    description: data.description,
    priority: data.priority || 'MEDIUM',
    status: INITIAL_STATUS[type],
    project: project ? project._id : null,
    requester: user._id,
    assignee: data.assignee || null,
    dueDate: data.dueDate || null,
  });

  await history.record({ workItem: item._id, actor: user._id, action: 'CREATED', to: item.status });
  const events = item.assignee ? [{ action: 'ASSIGNED', from: null, to: item.assignee }] : [];
  await publish(item, project, user, events);

  if (type === 'TICKET') {
    const recipients = await notifications.ticketCreatedRecipients(project);
    await notifications.notify({
      recipients, actor: user, type: 'TICKET_CREATED', entityId: item._id,
      message: `${user.name} raised a new ticket "${item.title}"`,
    });
  }
  return populated(item);
}

/* ---------- read ---------- */

async function list(user, q) {
  const and = [await buildVisibilityFilter(user)];
  ['status', 'type', 'priority', 'project'].forEach((k) => q[k] && and.push({ [k]: q[k] }));
  if (q.assignee) and.push({ assignee: q.assignee === 'me' ? user._id : q.assignee });
  if (q.requester) and.push({ requester: q.requester === 'me' ? user._id : q.requester });
  if (q.dueBefore) and.push({ dueDate: { $lte: q.dueBefore } });
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    and.push({ $or: [{ title: rx }, { description: rx }] });
  }
  const filter = { $and: and };
  const sort = { [SORT_MAP[q.sortBy]]: q.order === 'asc' ? 1 : -1, _id: -1 };

  const [data, total] = await Promise.all([
    WorkItem.find(filter).sort(sort).skip((q.page - 1) * q.limit).limit(q.limit).populate(POPULATE).lean(),
    WorkItem.countDocuments(filter),
  ]);
  return { data, meta: pageMeta(total, q.page, q.limit) };
}

// Returns the item plus what the caller may do with it, so the UI never re-implements rules.
async function getById(user, id) {
  const item = await populated(await getVisibleDoc(user, id));
  const scope = getUpdateScope(user, item, item.project);
  const involved = sameId(item.requester, user._id) || sameId(item.assignee, user._id);
  const privileged = scope === 'FULL';
  const locked = TERMINAL_STATUSES.includes(item.status);
  return {
    ...item.toJSON(),
    permissions: {
      editScope: locked ? null : scope,
      editableFields: locked ? [] : scope === 'FULL' ? FULL_FIELDS : scope === 'ASSIGNEE' ? ASSIGNEE_FIELDS : [],
      allowedNextStatuses: scope && !locked ? allowedTransitions(item.type, item.status, privileged) : [],
      canEscalate: item.type === 'TICKET' && !locked && (!!scope || involved) &&
        canTransition('TICKET', item.status, 'ESCALATED', privileged).ok,
      canDelete: user.role === ROLES.ADMIN,
    },
  };
}

async function getHistory(user, id) {
  const item = await getVisibleDoc(user, id);
  return history.forWorkItem(item._id);
}

/* ---------- update ---------- */

async function update(user, id, body) {
  const item = await getVisibleDoc(user, id);
  const project = item.project ? await Project.findById(item.project) : null;
  const scope = getUpdateScope(user, item, project);
  if (!scope) throw ApiError.forbidden('You cannot modify this work item');

  const allowed = scope === 'FULL' ? FULL_FIELDS : ASSIGNEE_FIELDS;
  const denied = Object.keys(body).filter((k) => !allowed.includes(k));
  if (denied.length) throw ApiError.forbidden(`You are not allowed to change: ${denied.join(', ')}`);
  if (TERMINAL_STATUSES.includes(item.status)) throw ApiError.conflict(`This item is ${item.status} and can no longer be modified`);

  const events = [];
  if (body.status && body.status !== item.status) events.push(moveStatus(item, body.status, scope === 'FULL'));

  if ('assignee' in body && !sameId(body.assignee, item.assignee)) {
    if (body.assignee) await assertAssignable(body.assignee, project);
    events.push({ action: 'ASSIGNED', from: item.assignee, to: body.assignee || null });
    item.assignee = body.assignee || null;
    item.dueSoonNotifiedAt = null;
  }
  if (body.priority && body.priority !== item.priority) {
    events.push({ action: 'PRIORITY_CHANGED', from: item.priority, to: body.priority });
    item.priority = body.priority;
  }
  if ('dueDate' in body) {
    const same = (body.dueDate && item.dueDate && body.dueDate.getTime() === item.dueDate.getTime()) || (!body.dueDate && !item.dueDate);
    if (!same) {
      events.push({ action: 'UPDATED', meta: { field: 'dueDate' }, from: item.dueDate, to: body.dueDate || null });
      item.dueDate = body.dueDate || null;
      item.dueSoonNotifiedAt = null;
    }
  }
  ['title', 'description'].forEach((f) => {
    if (f in body && body[f] !== item[f]) {
      events.push({ action: 'UPDATED', meta: { field: f } });
      item[f] = body[f];
    }
  });

  if (!events.length) return populated(item); // nothing changed
  await item.save();
  await publish(item, project, user, events);
  return populated(item);
}

async function escalate(user, id) {
  const item = await getVisibleDoc(user, id);
  if (item.type !== 'TICKET') throw ApiError.badRequest('Only tickets can be escalated');
  const project = item.project ? await Project.findById(item.project) : null;
  const scope = getUpdateScope(user, item, project);
  const involved = sameId(item.requester, user._id) || sameId(item.assignee, user._id);
  if (!scope && !involved) throw ApiError.forbidden('Only the requester, assignee or a manager can escalate this ticket');

  const event = moveStatus(item, 'ESCALATED', scope === 'FULL');
  await item.save();
  await publish(item, project, user, [event]);
  return populated(item);
}

/* ---------- delete (soft, admin only; route also enforces the role) ---------- */

async function remove(user, id) {
  if (user.role !== ROLES.ADMIN) throw ApiError.forbidden('Only admins can delete work items');
  const item = await getVisibleDoc(user, id);
  item.deletedAt = new Date();
  item.deletedBy = user._id;
  await item.save();
  await history.record({ workItem: item._id, actor: user._id, action: 'DELETED' });
}

module.exports = {
  create, list, getById, getHistory, update, escalate, remove, getVisibleDoc, POPULATE,
};
