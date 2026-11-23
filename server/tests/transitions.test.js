const { canTransition, allowedTransitions } = require('../src/constants/statuses');

describe('status transitions', () => {
  it('allows the happy path for tasks', () => {
    expect(canTransition('TASK', 'TODO', 'IN_PROGRESS', false).ok).toBe(true);
    expect(canTransition('TASK', 'IN_PROGRESS', 'IN_REVIEW', false).ok).toBe(true);
    expect(canTransition('TASK', 'IN_REVIEW', 'DONE', false).ok).toBe(true);
  });

  it('blocks skipping steps', () => {
    expect(canTransition('TASK', 'TODO', 'DONE', true).ok).toBe(false);
    expect(canTransition('TASK', 'IN_PROGRESS', 'DONE', true).ok).toBe(false);
  });

  it('keeps cancel/reopen/close staff-only', () => {
    expect(canTransition('TASK', 'TODO', 'CANCELLED', false).ok).toBe(false);
    expect(canTransition('TASK', 'TODO', 'CANCELLED', true).ok).toBe(true);
    expect(canTransition('TASK', 'DONE', 'IN_PROGRESS', false).ok).toBe(false);
    expect(canTransition('TICKET', 'RESOLVED', 'CLOSED', false).ok).toBe(false);
    expect(canTransition('TICKET', 'RESOLVED', 'CLOSED', true).ok).toBe(true);
  });

  it('terminal states have no exits, ESCALATED is ticket-only', () => {
    expect(allowedTransitions('TASK', 'CANCELLED', true)).toEqual([]);
    expect(allowedTransitions('TICKET', 'CLOSED', true)).toEqual([]);
    expect(canTransition('TASK', 'TODO', 'ESCALATED', true).ok).toBe(false);
    expect(canTransition('TICKET', 'OPEN', 'ESCALATED', false).ok).toBe(true);
  });

  it('only staff can pull a ticket out of ESCALATED', () => {
    expect(canTransition('TICKET', 'ESCALATED', 'RESOLVED', false).ok).toBe(false);
    expect(canTransition('TICKET', 'ESCALATED', 'RESOLVED', true).ok).toBe(true);
  });
});
