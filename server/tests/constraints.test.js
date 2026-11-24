// The database itself refuses bad data, even if application code had a bug.
const h = require('./helpers');

let manager, member, project;

beforeAll(async () => {
  await h.connect();
  manager = await h.makeUser('MANAGER', 'boss');
  member = await h.makeUser('MEMBER', 'worker');
  project = (await h.api(manager.token).post('/projects', { name: 'Constraint Project' })).body.data;
});
afterAll(h.disconnect);

const insertItem = (type, status, projectId) =>
  h.pool.query(
    'INSERT INTO work_items (type, title, status, project_id, requester_id) VALUES ($1, $2, $3, $4, $5)',
    [type, 'Some title', status, projectId, member.user.id]
  );

describe('database constraints', () => {
  it('a TASK cannot exist without a project', async () => {
    await expect(insertItem('TASK', 'TODO', null)).rejects.toMatchObject({ constraint: 'work_items_task_needs_project' });
    await expect(insertItem('TASK', 'TODO', project.id)).resolves.toBeDefined();
  });

  it('a status must belong to the item type (ESCALATED is for tickets only)', async () => {
    await expect(insertItem('TASK', 'ESCALATED', project.id)).rejects.toMatchObject({ constraint: 'work_items_status_matches_type' });
    await expect(insertItem('TICKET', 'ESCALATED', null)).resolves.toBeDefined();
  });

  it('emails are unique', async () => {
    await expect(
      h.pool.query("INSERT INTO users (name, email, password_hash) VALUES ('Dup', $1, 'x')", [member.user.email])
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('a user who raised work items cannot be deleted (foreign key RESTRICT)', async () => {
    await expect(h.pool.query('DELETE FROM users WHERE id = $1', [member.user.id])).rejects.toMatchObject({ code: '23001' });
  });

  it('deleting an assignee just unassigns their items (ON DELETE SET NULL)', async () => {
    const other = await h.makeUser('MANAGER', 'temp');
    const { rows } = await h.pool.query(
      `INSERT INTO work_items (type, title, status, requester_id, assignee_id)
       VALUES ('TICKET', 'Temp ticket', 'OPEN', $1, $2) RETURNING id`,
      [member.user.id, other.user.id]
    );
    await h.pool.query('DELETE FROM users WHERE id = $1', [other.user.id]);
    const after = await h.pool.query('SELECT assignee_id FROM work_items WHERE id = $1', [rows[0].id]);
    expect(after.rows[0].assignee_id).toBeNull();
  });

  it('updated_at moves forward automatically (trigger)', async () => {
    const { rows } = await h.pool.query(
      "INSERT INTO work_items (type, title, status, requester_id) VALUES ('TICKET', 'Trigger check', 'OPEN', $1) RETURNING id, updated_at",
      [member.user.id]
    );
    await new Promise((r) => setTimeout(r, 20));
    const upd = await h.pool.query("UPDATE work_items SET priority = 'HIGH' WHERE id = $1 RETURNING updated_at", [rows[0].id]);
    expect(upd.rows[0].updated_at.getTime()).toBeGreaterThan(rows[0].updated_at.getTime());
  });
});
