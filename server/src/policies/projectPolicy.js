const { ROLES } = require('../constants/roles');
const { sameId } = require('../utils/ids');

const isMember = (user, project) => project.members.some((m) => sameId(m, user._id));

const canAccessProject = (user, project) =>
  user.role === ROLES.ADMIN || sameId(project.owner, user._id) || isMember(user, project);

// Managers only manage projects they own; admins manage everything.
const canManageProject = (user, project) =>
  user.role === ROLES.ADMIN || (user.role === ROLES.MANAGER && sameId(project.owner, user._id));

module.exports = { canAccessProject, canManageProject, isMember };
