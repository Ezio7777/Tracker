const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'];
const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CLOSED'];
const ALL_STATUSES = [...new Set([...TASK_STATUSES, ...TICKET_STATUSES])];
const INITIAL_STATUS = { TASK: 'TODO', TICKET: 'OPEN' };
const TERMINAL_STATUSES = ['CANCELLED', 'CLOSED']; // item is locked
const CLOSED_LIKE = ['DONE', 'CANCELLED', 'RESOLVED', 'CLOSED']; // not "open work"

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const PRIORITY_RANK = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

// 'ANY'   = whoever may update the status (e.g. the assignee) can do it
// 'STAFF' = Manager (owner of the project / triage) or Admin only
const TRANSITIONS = {
  TASK: {
    TODO: { IN_PROGRESS: 'ANY', CANCELLED: 'STAFF' },
    IN_PROGRESS: { TODO: 'ANY', IN_REVIEW: 'ANY', CANCELLED: 'STAFF' },
    IN_REVIEW: { IN_PROGRESS: 'ANY', DONE: 'ANY' },
    DONE: { IN_PROGRESS: 'STAFF' },
    CANCELLED: {},
  },
  TICKET: {
    OPEN: { IN_PROGRESS: 'ANY', ESCALATED: 'ANY' },
    IN_PROGRESS: { OPEN: 'ANY', RESOLVED: 'ANY', ESCALATED: 'ANY' },
    ESCALATED: { IN_PROGRESS: 'STAFF', RESOLVED: 'STAFF' },
    RESOLVED: { CLOSED: 'STAFF', OPEN: 'STAFF' },
    CLOSED: {},
  },
};

function allowedTransitions(type, from, isStaff) {
  const map = (TRANSITIONS[type] && TRANSITIONS[type][from]) || {};
  return Object.entries(map)
    .filter(([, who]) => who === 'ANY' || isStaff)
    .map(([to]) => to);
}

function canTransition(type, from, to, isStaff) {
  const rule = TRANSITIONS[type] && TRANSITIONS[type][from] && TRANSITIONS[type][from][to];
  const allowed = allowedTransitions(type, from, isStaff);
  if (!rule) return { ok: false, reason: `${from} -> ${to} is not a valid transition for a ${type}`, allowed };
  if (rule === 'STAFF' && !isStaff) {
    return { ok: false, reason: `Only a manager or admin can move a ${type} from ${from} to ${to}`, allowed };
  }
  return { ok: true, allowed };
}

module.exports = {
  TASK_STATUSES, TICKET_STATUSES, ALL_STATUSES, INITIAL_STATUS, TERMINAL_STATUSES, CLOSED_LIKE,
  PRIORITIES, PRIORITY_RANK, TRANSITIONS, allowedTransitions, canTransition,
};
