const h = require('./helpers');

let admin, mgrA, mgrB, memA, memB, outsider, projA, projB;

beforeAll(async () => {
  await h.connect();
  await h.clear();
  [admin, mgrA, mgrB, memA, memB, outsider] = await Promise.all([
    h.makeUser('ADMIN'), h.makeUser('MANAGER', 'mgrA'), h.makeUser('MANAGER', 'mgrB'),
    h.makeUser('MEMBER', 'memA'), h.makeUser('MEMBER', 'memB'), h.makeUser('MEMBER', 'outsider'),
  ]);
  projA = (await h.api(mgrA.token).post('/projects', { name: 'Project A' })).body.data;
  projB = (await h.api(mgrB.token).post('/projects', { name: 'Project B' })).body.data;
  await h.api(mgrA.token).post(`/projects/${projA._id}/members`, { userId: String(memA.user._id) });
  await h.api(mgrB.token).post(`/projects/${projB._id}/members`, { userId: String(memB.user._id) });
});
afterAll(h.disconnect);

describe('projects', () => {
  it('members cannot create projects', async () => {
    expect((await h.api(memA.token).post('/projects', { name: 'Nope' })).status).toBe(403);
  });
  it("a manager cannot add members to someone else's project", async () => {
    const res = await h.api(mgrB.token).post(`/projects/${projA._id}/members`, { userId: String(memB.user._id) });
    expect([403, 404]).toContain(res.status);
  });
  it('members only see projects they belong to', async () => {
    const res = await h.api(memA.token).get('/projects');
    expect(res.body.data.map((p) => p.name)).toEqual(['Project A']);
  });
});

describe('work items: visibility, assignment, field-level rules', () => {
  let task;

  it('manager creates a task for a project member; non-members are rejected', async () => {
    const ok = await h.api(mgrA.token).post('/work-items', {
      type: 'TASK', title: 'Build login', project: projA._id, assignee: String(memA.user._id),
    });
    expect(ok.status).toBe(201);
    task = ok.body.data;
    const bad = await h.api(mgrA.token).post('/work-items', {
      type: 'TASK', title: 'Wrong person', project: projA._id, assignee: String(memB.user._id),
    });
    expect(bad.status).toBe(400);
  });

  it('members cannot create tasks, and a manager cannot create in a project they do not own', async () => {
    const body = { type: 'TASK', title: 'Sneaky task', project: projA._id };
    expect((await h.api(memA.token).post('/work-items', body)).status).toBe(403);
    expect((await h.api(mgrB.token).post('/work-items', body)).status).toBe(403);
  });

  it('GET /work-items is scoped to the caller', async () => {
    expect((await h.api(memA.token).get('/work-items')).body.meta.total).toBe(1);
    expect((await h.api(memB.token).get('/work-items')).body.meta.total).toBe(0);
    expect((await h.api(admin.token).get('/work-items')).body.meta.total).toBeGreaterThanOrEqual(1);
  });

  it('direct access to an invisible item looks like 404, for read, update and comment', async () => {
    expect((await h.api(memB.token).get(`/work-items/${task._id}`)).status).toBe(404);
    expect((await h.api(memB.token).patch(`/work-items/${task._id}`, { status: 'IN_PROGRESS' })).status).toBe(404);
    expect((await h.api(outsider.token).post(`/work-items/${task._id}/comments`, { body: 'hi' })).status).toBe(404);
  });

  it('assignee can change status/description only, and only along valid transitions', async () => {
    expect((await h.api(memA.token).patch(`/work-items/${task._id}`, { priority: 'CRITICAL' })).status).toBe(403);
    expect((await h.api(memA.token).patch(`/work-items/${task._id}`, { assignee: String(memA.user._id) })).status).toBe(403);
    expect((await h.api(memA.token).patch(`/work-items/${task._id}`, { status: 'DONE' })).status).toBe(422);
    const ok = await h.api(memA.token).patch(`/work-items/${task._id}`, { status: 'IN_PROGRESS' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('IN_PROGRESS');
  });

  it('the detail endpoint tells the UI what the caller may do', async () => {
    const res = await h.api(memA.token).get(`/work-items/${task._id}`);
    expect(res.body.data.permissions.editScope).toBe('ASSIGNEE');
    expect(res.body.data.permissions.allowedNextStatuses).toEqual(expect.arrayContaining(['TODO', 'IN_REVIEW']));
    expect(res.body.data.permissions.canDelete).toBe(false);
  });

  it('comments are visible to anyone who can see the item', async () => {
    const res = await h.api(memA.token).post(`/work-items/${task._id}/comments`, { body: 'Working on it' });
    expect(res.status).toBe(201);
    const list = await h.api(mgrA.token).get(`/work-items/${task._id}/comments`);
    expect(list.body.data).toHaveLength(1);
  });

  it('members can raise tickets but cannot set an assignee; managers see project-less tickets', async () => {
    const bad = await h.api(memA.token).post('/work-items', { type: 'TICKET', title: 'Help me', assignee: String(mgrA.user._id) });
    expect(bad.status).toBe(403);
    const ok = await h.api(memA.token).post('/work-items', { type: 'TICKET', title: 'VPN is down' });
    expect(ok.status).toBe(201);
    expect(ok.body.data.status).toBe('OPEN');
    const seenByMgr = await h.api(mgrB.token).get(`/work-items?type=TICKET&q=vpn`);
    expect(seenByMgr.body.meta.total).toBe(1);
    expect((await h.api(memB.token).get(`/work-items/${ok.body.data._id}`)).status).toBe(404);
  });

  it('delete is admin-only and soft', async () => {
    expect((await h.api(mgrA.token).delete(`/work-items/${task._id}`)).status).toBe(403);
    expect((await h.api(memA.token).delete(`/work-items/${task._id}`)).status).toBe(403);
    expect((await h.api(admin.token).delete(`/work-items/${task._id}`)).status).toBe(204);
    expect((await h.api(mgrA.token).get(`/work-items/${task._id}`)).status).toBe(404);
  });
});

describe('notifications', () => {
  it('assignment notifies the assignee; only the recipient can mark it read', async () => {
    const list = await h.api(memA.token).get('/notifications?unread=true');
    const assigned = list.body.data.find((n) => n.type === 'ASSIGNED');
    expect(assigned).toBeDefined();
    expect(list.body.meta.unreadCount).toBeGreaterThan(0);

    expect((await h.api(memB.token).patch(`/notifications/${assigned._id}/read`)).status).toBe(404);
    expect((await h.api(admin.token).patch(`/notifications/${assigned._id}/read`)).status).toBe(404);
    const ok = await h.api(memA.token).patch(`/notifications/${assigned._id}/read`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.isRead).toBe(true);
  });

  it('only admins may list everyone\'s notifications', async () => {
    expect((await h.api(memA.token).get('/notifications?scope=all')).status).toBe(403);
    expect((await h.api(admin.token).get('/notifications?scope=all')).status).toBe(200);
  });
});

describe('admin user management', () => {
  it('only admins manage roles; admins cannot change their own', async () => {
    const target = String(memB.user._id);
    expect((await h.api(mgrA.token).patch(`/users/${target}/role`, { role: 'ADMIN' })).status).toBe(403);
    expect((await h.api(admin.token).patch(`/users/${String(admin.user._id)}/role`, { role: 'MEMBER' })).status).toBe(400);
    expect((await h.api(admin.token).patch(`/users/${target}/role`, { role: 'MANAGER' })).status).toBe(200);
  });
});
