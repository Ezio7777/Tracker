const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../constants/roles');
const { sameId } = require('../utils/ids');
const { pageMeta, escapeRegex } = require('../utils/pagination');
const { disconnectUser } = require('../sockets');
const authService = require('./authService');

async function list(actor, { role, q, isActive, page, limit }) {
  const filter = {};
  let select = '';
  if (actor.role === ROLES.MANAGER) {
    // Managers only get a minimal picker list of assignable people
    if (role === ROLES.ADMIN) throw ApiError.forbidden('Managers cannot list admins');
    filter.isActive = true;
    filter.role = role || { $in: [ROLES.MEMBER, ROLES.MANAGER] };
    select = 'name email role';
  } else {
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive;
  }
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const [data, total] = await Promise.all([
    User.find(filter).select(select).sort({ name: 1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  return { data, meta: pageMeta(total, page, limit) };
}

async function updateRole(actor, id, role) {
  if (sameId(actor._id, id)) throw ApiError.badRequest('You cannot change your own role');
  const user = await User.findByIdAndUpdate(id, { role }, { new: true });
  if (!user) throw ApiError.notFound('User not found');
  disconnectUser(id); // sockets re-auth with their new role
  return user;
}

async function updateStatus(actor, id, isActive) {
  if (sameId(actor._id, id)) throw ApiError.badRequest('You cannot deactivate yourself');
  const user = await User.findByIdAndUpdate(id, { isActive }, { new: true });
  if (!user) throw ApiError.notFound('User not found');
  if (!isActive) {
    await authService.revokeAllForUser(id);
    disconnectUser(id);
  }
  return user;
}

module.exports = { list, updateRole, updateStatus };
