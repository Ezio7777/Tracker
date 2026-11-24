export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'];
export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'CLOSED'];
export const ALL_STATUSES = [...new Set([...TASK_STATUSES, ...TICKET_STATUSES])];
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
export const CLOSED_LIKE = ['DONE', 'CANCELLED', 'RESOLVED', 'CLOSED'];
export const isStaff = (user) => user && (user.role === 'ADMIN' || user.role === 'MANAGER');
