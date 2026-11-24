const { ROLES } = require('../constants/roles');

const isMember = (user, project) => project.members.some((m) => m.id === user.id);

const canAccessProject = (user, project) =>
  user.role === ROLES.ADMIN || project.managerId === user.id || isMember(user, project);

// Managers only manage projects assigned to them; admins manage everything.
const canManageProject = (user, project) =>
  user.role === ROLES.ADMIN || (user.role === ROLES.MANAGER && project.managerId === user.id);

module.exports = { canAccessProject, canManageProject, isMember };
