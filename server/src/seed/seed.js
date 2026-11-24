/* Demo data. Run with `npm run seed`.
   It applies any pending migrations, wipes the tables, and recreates users, projects, work items,
   comments, history and notifications so that every role has something to look at. */
const bcrypt = require('bcrypt');
const env = require('../config/env');
const { pool, queryOne } = require('../db/pool');
const { migrate } = require('../db/migrate');
const { INITIAL_STATUS } = require('../constants/statuses');

const PASSWORD = 'Password@123';
const hoursAgo = (h) => new Date(Date.now() - h * 3600000);
const inHours = (h) => new Date(Date.now() + h * 3600000);

async function seed() {
  await migrate({ log: () => {} });
  await pool.query(`TRUNCATE TABLE notifications, work_item_history, comments, work_items,
                    project_members, projects, refresh_tokens, users CASCADE`);

  /* ---------- users ---------- */
  const passwordHash = await bcrypt.hash(PASSWORD, env.bcryptRounds);
  const addUser = (name, email, role) =>
    queryOne('INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name, email, passwordHash, role]);

  const admin = await addUser('Ada Admin', 'admin@tracker.dev', 'ADMIN');
  const maya = await addUser('Maya Manager', 'manager1@tracker.dev', 'MANAGER');
  const marcus = await addUser('Marcus Manager', 'manager2@tracker.dev', 'MANAGER');
  const mia = await addUser('Mia Member', 'member1@tracker.dev', 'MEMBER');
  const milo = await addUser('Milo Member', 'member2@tracker.dev', 'MEMBER');
  const nora = await addUser('Nora Member', 'member3@tracker.dev', 'MEMBER');
  const noah = await addUser('Noah Member', 'member4@tracker.dev', 'MEMBER');
  const everyone = [admin, maya, marcus, mia, milo, nora, noah];
  const byId = Object.fromEntries(everyone.map((u) => [u.id, u]));

  /* ---------- projects ---------- */
  const addProject = async (name, description, manager, members, status = 'ACTIVE') => {
    const project = await queryOne(
      'INSERT INTO projects (name, description, manager_id, status) VALUES ($1, $2, $3, $4) RETURNING id, name, manager_id',
      [name, description, manager.id, status]);
    for (const member of members) {
      await pool.query('INSERT INTO project_members (project_id, user_id) VALUES ($1, $2)', [project.id, member.id]);
    }
    return { ...project, manager };
  };
  const web = await addProject('Website Revamp', 'New marketing site and design system.', maya, [mia, milo, nora]);
  const mobile = await addProject('Mobile App', 'iOS and Android client for customers.', marcus, [nora, noah]);
  const tools = await addProject('Internal Tools', 'Dashboards and automation for the ops team.', maya, [milo, noah]);
  await addProject('Legacy Migration', 'Move the old monolith to the new platform.', marcus, [mia], 'ARCHIVED');

  /* ---------- work items ---------- */
  const addItem = async (type, title, description, status, priority, project, requester, assignee, due, age) => {
    const item = await queryOne(
      `INSERT INTO work_items (type, title, description, status, priority, project_id, requester_id, assignee_id,
                               due_date, escalated_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [type, title, description, status, priority, project ? project.id : null, requester.id, assignee ? assignee.id : null,
        due, status === 'ESCALATED' ? hoursAgo(age / 3) : null, hoursAgo(age), hoursAgo(age / 2)]);
    return item;
  };
  const task = (...args) => addItem('TASK', ...args);
  const ticket = (...args) => addItem('TICKET', ...args);

  const items = [
    // Website Revamp (Maya)
    await task('Design landing page hero', 'Hero section with new brand colours and a clear call to action.', 'IN_PROGRESS', 'HIGH', web, maya, mia, inHours(5), 70),
    await task('Set up CI pipeline', 'Lint, test and preview deploys on every pull request.', 'TODO', 'MEDIUM', web, maya, milo, inHours(96), 60),
    await task('Write launch copy', 'Headline, subheads and product blurbs for the homepage.', 'IN_REVIEW', 'LOW', web, maya, nora, inHours(48), 55),
    await task('Fix broken footer links', 'Several footer links return 404 after the URL restructure.', 'DONE', 'LOW', web, maya, mia, null, 120),
    await task('Accessibility audit', 'Run an audit and fix contrast and keyboard issues.', 'TODO', 'HIGH', web, maya, milo, hoursAgo(30), 90),
    await task('Cookie banner', 'Add a consent banner that respects regional rules.', 'CANCELLED', 'LOW', web, maya, null, null, 140),
    // Mobile App (Marcus)
    await task('Push notification prototype', 'Prototype push notifications for order updates.', 'TODO', 'URGENT', mobile, marcus, nora, hoursAgo(20), 80),
    await task('Onboarding flow screens', 'Three-step onboarding with skip option.', 'IN_PROGRESS', 'MEDIUM', mobile, marcus, noah, inHours(72), 50),
    await task('Crash reporting integration', 'Hook up crash reports and symbol uploads.', 'IN_REVIEW', 'HIGH', mobile, marcus, nora, inHours(30), 40),
    // Internal Tools (Maya)
    await task('Weekly ops report automation', 'Generate the weekly ops report and email it on Mondays.', 'IN_PROGRESS', 'MEDIUM', tools, maya, milo, inHours(120), 45),
    await task('Admin dashboard charts', 'Add charts for volume and resolution time.', 'TODO', 'LOW', tools, maya, noah, null, 25),
    // Tickets
    await ticket('Cannot reset my password', 'The reset email never arrives.', 'OPEN', 'HIGH', null, mia, null, null, 6),
    await ticket('Site is slow on mobile', 'Pages take 8+ seconds on 4G.', 'IN_PROGRESS', 'MEDIUM', web, milo, mia, null, 30),
    await ticket('Billing page returns 500', 'Opening Billing shows a server error since this morning.', 'ESCALATED', 'URGENT', null, nora, maya, null, 12),
    await ticket('Request: dark mode', 'Would love a dark theme in the app.', 'OPEN', 'LOW', mobile, noah, null, null, 18),
    await ticket('Export to CSV broken', 'CSV export downloads an empty file.', 'RESOLVED', 'MEDIUM', tools, milo, noah, null, 100),
    await ticket('Wrong invoice total', 'The invoice total does not match the line items.', 'OPEN', 'MEDIUM', null, mia, null, null, 3),
  ];
  const byTitle = Object.fromEntries(items.map((i) => [i.title, i]));
  const managerOf = (item) => (item.projectId === web.id || item.projectId === tools.id ? maya : item.projectId === mobile.id ? marcus : maya);

  /* ---------- history (activity log) ---------- */
  const addHistory = (item, actor, action, from, to, createdAt) =>
    pool.query(
      'INSERT INTO work_item_history (work_item_id, actor_id, action, from_value, to_value, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [item.id, actor.id, action, from, to, createdAt]);

  for (const item of items) {
    await addHistory(item, byId[item.requesterId], 'CREATED', null, INITIAL_STATUS[item.type], item.createdAt);
    if (item.assigneeId) await addHistory(item, managerOf(item), 'ASSIGNED', null, item.assigneeId, item.createdAt);
    if (item.status !== INITIAL_STATUS[item.type]) {
      const actor = byId[item.assigneeId] || byId[item.requesterId];
      await addHistory(item, actor, item.status === 'ESCALATED' ? 'ESCALATED' : 'STATUS_CHANGED', INITIAL_STATUS[item.type], item.status, item.updatedAt);
    }
  }

  /* ---------- comments ---------- */
  const addComment = (item, author, body, age) =>
    pool.query('INSERT INTO comments (work_item_id, author_id, body, created_at) VALUES ($1, $2, $3, $4)',
      [item.id, author.id, body, hoursAgo(age)]);
  await addComment(byTitle['Design landing page hero'], maya, 'Please use the new brand colours and keep the hero under 600px tall.', 40);
  await addComment(byTitle['Design landing page hero'], mia, 'On it. First draft ready by tomorrow morning.', 38);
  await addComment(byTitle['Write launch copy'], nora, 'Draft is ready for review, moved to In review.', 20);
  await addComment(byTitle['Billing page returns 500'], nora, 'This blocks every customer from paying, escalating.', 5);
  await addComment(byTitle['Billing page returns 500'], maya, 'Looking into it now. Logs show a failing tax-service call.', 4);
  await addComment(byTitle['Cannot reset my password'], marcus, 'Can you tell us which email address you used?', 2);

  /* ---------- notifications ---------- */
  const addNote = (recipient, type, message, item, isRead, age) =>
    pool.query(
      `INSERT INTO notifications (recipient_id, type, message, entity_id, is_read, read_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [recipient.id, type, message, item.id, isRead, isRead ? hoursAgo(age - 0.5) : null, hoursAgo(age)]);

  for (const [index, item] of items.entries()) {
    const manager = managerOf(item);
    if (item.assigneeId && item.assigneeId !== manager.id) {
      await addNote(byId[item.assigneeId], 'ASSIGNED', `${manager.name} assigned you "${item.title}"`, item, index % 3 === 0, index + 1);
    }
    if (item.type === 'TICKET') {
      const requester = byId[item.requesterId];
      const recipients = item.projectId ? [managerOf(item)] : [admin, maya, marcus];
      const escalated = item.status === 'ESCALATED';
      for (const recipient of recipients) {
        await addNote(recipient, escalated ? 'ESCALATED' : 'TICKET_CREATED',
          escalated ? `${requester.name} escalated ticket "${item.title}"` : `${requester.name} raised a new ticket "${item.title}"`,
          item, false, index);
      }
    }
  }
  await addNote(mia, 'COMMENTED', 'Maya Manager commented on "Design landing page hero"', byTitle['Design landing page hero'], false, 40);
  await addNote(nora, 'DUE_SOON', '"Crash reporting integration" is due within 30 hours', byTitle['Crash reporting integration'], false, 1);

  console.log(`\nSeeded ${items.length} work items in 4 projects. Log in with password: ${PASSWORD}\n`);
  everyone.forEach((u) => console.log(`  ${u.role.padEnd(8)} ${u.email.padEnd(24)} ${u.name}`));
  console.log('\nThe running API picks the new data up immediately; just log in again.');
}

seed()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
