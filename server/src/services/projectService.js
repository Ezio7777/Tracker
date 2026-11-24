const projectRepository = require('../repositories/projectRepository');
const userRepository = require('../repositories/userRepository');
const workItemRepository = require('../repositories/workItemRepository');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../constants/roles');
const { canAccessProject, canManageProject } = require('../policies/projectPolicy');
const { pageMeta } = require('../utils/pagination');

const create = (user, { name, description }) =>
  projectRepository.insert({ name, description, managerId: user.id });

async function list(user, { status, q, page, limit }) {
  const { data, total } = await projectRepository.list({ user, status, q, page, limit });
  return { data, meta: pageMeta(total, page, limit) };
}

// A project the caller cannot see is reported as 404 (not 403), so ids cannot be probed.
async function getAccessible(user, id) {
  const project = await projectRepository.findById(id);
  if (!project || !canAccessProject(user, project)) throw ApiError.notFound('Project not found');
  return project;
}

async function getManageable(user, id) {
  const project = await getAccessible(user, id);
  if (!canManageProject(user, project)) throw ApiError.forbidden('Only the project manager or an admin can do this');
  return project;
}

const getOne = (user, id) => getAccessible(user, id);

async function update(user, id, changes) {
  await getManageable(user, id);
  return projectRepository.update(id, changes);
}

async function addMember(user, id, userId) {
  const project = await getManageable(user, id);
  const target = await userRepository.findActiveById(userId);
  if (!target) throw ApiError.badRequest('User not found or inactive');
  if (target.role === ROLES.ADMIN) throw ApiError.badRequest('Admins already have access to every project');
  if (target.id === project.managerId) throw ApiError.badRequest('The manager is already part of the project');
  await projectRepository.addMember(id, target.id);
  return projectRepository.findById(id);
}

async function removeMember(user, id, userId) {
  await getManageable(user, id);
  if (await workItemRepository.hasOpenAssigned(id, userId)) {
    throw ApiError.conflict("Reassign this member's open work items before removing them");
  }
  await projectRepository.removeMember(id, userId);
  return projectRepository.findById(id);
}

module.exports = { create, list, getOne, update, addMember, removeMember };
