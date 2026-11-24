const userRepository = require('../repositories/userRepository');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../constants/roles');
const { pageMeta } = require('../utils/pagination');
const { disconnectUser } = require('../sockets');
const authService = require('./authService');

async function list(actor, { role, q, isActive, page, limit }) {
  let filters = { role, q, isActive, page, limit };
  if (actor.role === ROLES.MANAGER) {
    // Managers only get a short list of people they could assign work to.
    if (role === ROLES.ADMIN) throw ApiError.forbidden('Managers cannot list admins');
    filters = { role, q, page, limit, isActive: true, minimal: true, roles: [ROLES.MEMBER, ROLES.MANAGER] };
  }
  const { data, total } = await userRepository.list(filters);
  return { data, meta: pageMeta(total, page, limit) };
}

async function updateRole(actor, id, role) {
  if (actor.id === id) throw ApiError.badRequest('You cannot change your own role');
  const user = await userRepository.updateRole(id, role);
  if (!user) throw ApiError.notFound('User not found');
  disconnectUser(id); // their live sockets reconnect with the new role
  return user;
}

async function updateStatus(actor, id, isActive) {
  if (actor.id === id) throw ApiError.badRequest('You cannot deactivate yourself');
  const user = await userRepository.updateActive(id, isActive);
  if (!user) throw ApiError.notFound('User not found');
  if (!isActive) {
    await authService.revokeAllForUser(id);
    disconnectUser(id);
  }
  return user;
}

module.exports = { list, updateRole, updateStatus };
