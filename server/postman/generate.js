// Generates postman/tracker.postman_collection.json  ->  npm run postman
const fs = require('fs');
const path = require('path');

const set = (name, expr) => `pm.collectionVariables.set('${name}', ${expr});`;
const status = (code) => `pm.test('status is ${code}', () => pm.response.to.have.status(${code}));`;

const req = (name, method, url, { body, tests = [], noAuth } = {}) => ({
  name,
  event: tests.length ? [{ listen: 'test', script: { type: 'text/javascript', exec: tests } }] : [],
  request: {
    method,
    header: body ? [{ key: 'Content-Type', value: 'application/json' }] : [],
    ...(noAuth ? { auth: { type: 'noauth' } } : {}),
    ...(body ? { body: { mode: 'raw', raw: JSON.stringify(body, null, 2) } } : {}),
    url: { raw: `{{baseUrl}}${url}`, host: ['{{baseUrl}}'], path: url.split('?')[0].split('/').filter(Boolean),
      ...(url.includes('?') ? { query: url.split('?')[1].split('&').map((p) => ({ key: p.split('=')[0], value: p.split('=')[1] })) } : {}) },
  },
});

const login = (label, email) => req(`Login as ${label}`, 'POST', '/auth/login', {
  noAuth: true,
  body: { email, password: 'Password@123' },
  tests: [status(200), 'const j = pm.response.json();', set('accessToken', 'j.data.accessToken'), set('userId', 'j.data.user.id')],
});

const folders = [
  ['1. Auth', [
    req('Register (always MEMBER)', 'POST', '/auth/register', { noAuth: true, body: { name: 'New User', email: `new${Date.now()}@tracker.dev`, password: 'Password1' }, tests: [status(201)] }),
    login('Admin', 'admin@tracker.dev'),
    login('Manager', 'manager1@tracker.dev'),
    login('Member', 'member1@tracker.dev'),
    req('Me', 'GET', '/auth/me', { tests: [status(200)] }),
    req('Refresh (uses httpOnly cookie)', 'POST', '/auth/refresh', { noAuth: true, tests: [status(200), set('accessToken', 'pm.response.json().data.accessToken')] }),
    req('Logout', 'POST', '/auth/logout', { noAuth: true, tests: [status(204)] }),
  ]],
  ['2. Users (Admin / Manager)', [
    req('List users (picker for managers)', 'GET', '/users?limit=50', {
      tests: [status(200), "const m = pm.response.json().data.find(u => u.role === 'MEMBER');", "if (m) " + set('memberUserId', 'm.id')],
    }),
    req('Change role (Admin)', 'PATCH', '/users/{{memberUserId}}/role', { body: { role: 'MEMBER' }, tests: [status(200)] }),
    req('Deactivate / activate (Admin)', 'PATCH', '/users/{{memberUserId}}/status', { body: { isActive: true }, tests: [status(200)] }),
  ]],
  ['3. Projects (log in as Manager)', [
    req('Create project', 'POST', '/projects', { body: { name: `Postman Project ${Date.now()}`, description: 'Created from Postman' }, tests: [status(201), set('projectId', 'pm.response.json().data.id')] }),
    req('List projects', 'GET', '/projects', { tests: [status(200)] }),
    req('Get project', 'GET', '/projects/{{projectId}}', { tests: [status(200)] }),
    req('Update project', 'PATCH', '/projects/{{projectId}}', { body: { description: 'Updated' }, tests: [status(200)] }),
    req('Add member', 'POST', '/projects/{{projectId}}/members', { body: { userId: '{{memberUserId}}' }, tests: [status(200)] }),
    req('Remove member', 'DELETE', '/projects/{{projectId}}/members/{{memberUserId}}', { tests: [status(200)] }),
  ]],
  ['4. Work items', [
    req('Create TASK (Manager, assign to member)', 'POST', '/work-items', {
      body: { type: 'TASK', title: 'Postman task', description: 'From Postman', priority: 'HIGH', project: '{{projectId}}', assignee: '{{memberUserId}}', dueDate: new Date(Date.now() + 7 * 864e5).toISOString() },
      tests: [status(201), set('workItemId', 'pm.response.json().data.id')],
    }),
    req('Raise TICKET (any role)', 'POST', '/work-items', { body: { type: 'TICKET', title: 'Postman ticket', description: 'Something is broken', priority: 'MEDIUM' }, tests: [status(201), set('ticketId', 'pm.response.json().data.id')] }),
    req('List (filters + pagination + sorting)', 'GET', '/work-items?status=TODO&type=TASK&priority=HIGH&assignee=me&q=postman&sortBy=priority&order=desc&page=1&limit=10', { tests: [status(200)] }),
    req('Get one (+ permissions block)', 'GET', '/work-items/{{workItemId}}', { tests: [status(200)] }),
    req('Update status (valid transition)', 'PATCH', '/work-items/{{workItemId}}', { body: { status: 'IN_PROGRESS' }, tests: [status(200)] }),
    req('Update priority (Manager/Admin)', 'PATCH', '/work-items/{{workItemId}}', { body: { priority: 'URGENT' }, tests: [status(200)] }),
    req('Invalid transition IN_PROGRESS -> DONE (expect 422)', 'PATCH', '/work-items/{{workItemId}}', { body: { status: 'DONE' }, tests: [status(422)] }),
    req('Escalate ticket', 'POST', '/work-items/{{ticketId}}/escalate', { tests: [status(200)] }),
    req('History / audit trail', 'GET', '/work-items/{{workItemId}}/history', { tests: [status(200)] }),
    req('Delete (Admin only, soft)', 'DELETE', '/work-items/{{workItemId}}', { tests: [status(204)] }),
  ]],
  ['5. Comments', [
    req('Add comment', 'POST', '/work-items/{{ticketId}}/comments', { body: { body: 'Looking into this' }, tests: [status(201)] }),
    req('List comments', 'GET', '/work-items/{{ticketId}}/comments', { tests: [status(200)] }),
  ]],
  ['6. Notifications', [
    req('List (unread only)', 'GET', '/notifications?unread=true', { tests: [status(200), 'const d = pm.response.json().data;', "if (d.length) " + set('notificationId', 'd[0].id')] }),
    req('Unread count', 'GET', '/notifications/unread-count', { tests: [status(200)] }),
    req('Mark one read', 'PATCH', '/notifications/{{notificationId}}/read', { tests: [status(200)] }),
    req('Mark all read', 'PATCH', '/notifications/read-all', { tests: [status(200)] }),
    req('List ALL notifications (Admin)', 'GET', '/notifications?scope=all', { tests: [status(200)] }),
  ]],
  ['7. Dashboard', [req('Summary', 'GET', '/dashboard/summary', { tests: [status(200)] })]],
  ['8. Negative checks (log in as Member first)', [
    req('Member creates project -> 403', 'POST', '/projects', { body: { name: 'Nope' }, tests: [status(403)] }),
    req('Member lists users -> 403', 'GET', '/users', { tests: [status(403)] }),
    req('Member deletes work item -> 403', 'DELETE', '/work-items/{{ticketId}}', { tests: [status(403)] }),
    req('No token -> 401', 'GET', '/work-items', { noAuth: true, tests: [status(401)] }),
  ]],
];

const collection = {
  info: {
    name: 'Unified Task & Ticket Tracker',
    description: 'Run order: 1 Login as Manager -> Users -> Projects -> Work items. Log in as Member/Admin to try other roles and folder 8.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }] },
  variable: ['baseUrl', 'accessToken', 'userId', 'memberUserId', 'projectId', 'workItemId', 'ticketId', 'notificationId']
    .map((key) => ({ key, value: key === 'baseUrl' ? 'http://localhost:5000' : '' })),
  item: folders.map(([name, item]) => ({ name, item })),
};

fs.writeFileSync(path.join(__dirname, 'tracker.postman_collection.json'), JSON.stringify(collection, null, 2));
console.log('Wrote postman/tracker.postman_collection.json');
