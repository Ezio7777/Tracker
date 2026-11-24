const { ROLES } = require('../constants/roles');
const { sameId } = require('../utils/ids');

const FULL_FIELDS = ['title', 'description', 'status', 'priority', 'assignee', 'dueDate'];
const ASSIGNEE_FIELDS = ['status', 'description'];

/**
 * The WHERE clause that decides which work items a user is allowed to SEE.
 * Every list and every single-item lookup uses it, so a row the user may not see is never even read
 * (which also keeps pagination and counts correct).
 *
 *   admin    everything that is not deleted
 *   manager  items in projects they manage or belong to, items they raised or are assigned,
 *            plus tickets that belong to no project (the support queue)
 *   member   items in projects they belong to, items they raised, items assigned to them
 *
 * `add` registers a query parameter and returns its placeholder (see utils/sql.js).
 */
function visibilitySql(user, add) {
  const notDeleted = 'w.deleted_at IS NULL';
  if (user.role === ROLES.ADMIN) return notDeleted;

  const me = add(user.id);
  const rules = [
    `w.requester_id = ${me}`,
    `w.assignee_id = ${me}`,
    `w.project_id IN (SELECT project_id FROM project_members WHERE user_id = ${me})`,
    `w.project_id IN (SELECT id FROM projects WHERE manager_id = ${me})`,
  ];
  if (user.role === ROLES.MANAGER) rules.push(`(w.type = 'TICKET' AND w.project_id IS NULL)`);
  return `${notDeleted} AND (${rules.join(' OR ')})`;
}

/**
 * What may this user CHANGE on an item they can already see?
 *   FULL      admin, the manager of the item's project, or any manager for a project-less ticket
 *   ASSIGNEE  the assignee: status and description only
 *   null      read only
 * `project` needs a managerId (null for project-less tickets).
 */
function getUpdateScope(user, item, project) {
  if (user.role === ROLES.ADMIN) return 'FULL';
  if (user.role === ROLES.MANAGER) {
    if (project && project.managerId === user.id) return 'FULL';
    if (!project && item.type === 'TICKET') return 'FULL';
  }
  if (sameId(item.assigneeId, user.id)) return 'ASSIGNEE';
  return null;
}

module.exports = { visibilitySql, getUpdateScope, FULL_FIELDS, ASSIGNEE_FIELDS };
