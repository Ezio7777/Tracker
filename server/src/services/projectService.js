const Project = require('../models/Project');
const User = require('../models/User');
const WorkItem = require('../models/WorkItem');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../constants/roles');
const { CLOSED_LIKE } = require('../constants/statuses');
const { canAccessProject, canManageProject } = require('../policies/projectPolicy');
const { pageMeta, escapeRegex } = require('../utils/pagination');

const POPULATE = [
  { path: 'owner', select: 'name email role' },
  { path: 'members', select: 'name email role' },
];

async function create(user, { name, description }) {
  const project = await Project.create({ name, description, owner: user._id, members: [] });
  return project.populate(POPULATE);
}

async function list(user, { status, q, page, limit }) {
  let filter = {};
  if (user.role === ROLES.MANAGER) filter = { $or: [{ owner: user._id }, { members: user._id }] };
  if (user.role === ROLES.MEMBER) filter = { members: user._id };
  if (status) filter.status = status;
  if (q) filter.name = new RegExp(escapeRegex(q), 'i');

  const [data, total] = await Promise.all([
    Project.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate(POPULATE),
    Project.countDocuments(filter),
  ]);
  return { data, meta: pageMeta(total, page, limit) };
}

// 404 (not 403) when the project is invisible to the caller, so ids can't be probed.
async function getAccessible(user, id) {
  const project = await Project.findById(id);
  if (!project || !canAccessProject(user, project)) throw ApiError.notFound('Project not found');
  return project;
}

async function getManageable(user, id) {
  const project = await getAccessible(user, id);
  if (!canManageProject(user, project)) throw ApiError.forbidden('Only the project owner or an admin can do this');
  return project;
}

async function getOne(user, id) {
  const project = await getAccessible(user, id);
  return project.populate(POPULATE);
}

async function update(user, id, changes) {
  const project = await getManageable(user, id);
  Object.assign(project, changes);
  await project.save();
  return project.populate(POPULATE);
}

async function addMember(user, id, userId) {
  const project = await getManageable(user, id);
  const target = await User.findOne({ _id: userId, isActive: true });
  if (!target) throw ApiError.badRequest('User not found or inactive');
  if (target.role === ROLES.ADMIN) throw ApiError.badRequest('Admins already have access to every project');
  if (String(project.owner) === String(target._id)) throw ApiError.badRequest('The owner is already part of the project');
  await Project.updateOne({ _id: project._id }, { $addToSet: { members: target._id } }); // idempotent
  return getOne(user, id);
}

async function removeMember(user, id, userId) {
  const project = await getManageable(user, id);
  const hasOpenWork = await WorkItem.exists({
    project: project._id, assignee: userId, deletedAt: null, status: { $nin: CLOSED_LIKE },
  });
  if (hasOpenWork) throw ApiError.conflict('Reassign this member\'s open work items before removing them');
  await Project.updateOne({ _id: project._id }, { $pull: { members: userId } });
  return getOne(user, id);
}

module.exports = { create, list, getOne, update, addMember, removeMember };
