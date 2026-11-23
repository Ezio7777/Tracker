const Project = require('../models/Project');
const { ROLES } = require('../constants/roles');
const { sameId } = require('../utils/ids');

const FULL_FIELDS = ['title', 'description', 'status', 'priority', 'assignee', 'dueDate'];
const ASSIGNEE_FIELDS = ['status', 'description'];

/**
 * Mongo filter of every work item the user may SEE. Merged into every list/get query,
 * so unauthorized rows are never fetched (pagination and counts stay correct).
 */
async function buildVisibilityFilter(user) {
  const base = { deletedAt: null };
  if (user.role === ROLES.ADMIN) return base;

  const projectIds = await Project.find({ $or: [{ owner: user._id }, { members: user._id }] }).distinct('_id');
  const or = [{ project: { $in: projectIds } }, { requester: user._id }, { assignee: user._id }];
  // Managers also see the project-less ticket queue (support triage)
  if (user.role === ROLES.MANAGER) or.push({ type: 'TICKET', project: null });
  return { ...base, $or: or };
}

/**
 * What may this user EDIT on an item they can already see?
 *  'FULL'     admin, or manager who owns the project (or any manager for project-less tickets)
 *  'ASSIGNEE' the assignee: status + description only
 *  null       read-only
 */
function getUpdateScope(user, item, project) {
  if (user.role === ROLES.ADMIN) return 'FULL';
  if (user.role === ROLES.MANAGER) {
    if (project && sameId(project.owner, user._id)) return 'FULL';
    if (!project && item.type === 'TICKET') return 'FULL';
  }
  if (sameId(item.assignee, user._id)) return 'ASSIGNEE';
  return null;
}

module.exports = { buildVisibilityFilter, getUpdateScope, FULL_FIELDS, ASSIGNEE_FIELDS };
