/* Demo data: `npm run seed`. Wipes the database and recreates users, projects, items,
   comments, history and notifications so every role has something to look at. */
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const env = require('../config/env');
const connectDB = require('../config/db');
const User = require('../models/User');
const Project = require('../models/Project');
const WorkItem = require('../models/WorkItem');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const History = require('../models/WorkItemHistory');
const RefreshToken = require('../models/RefreshToken');
const { INITIAL_STATUS } = require('../constants/statuses');

const PASSWORD = 'Password@123';
const hoursAgo = (h) => new Date(Date.now() - h * 3600000);
const inHours = (h) => new Date(Date.now() + h * 3600000);

async function seed() {
  await connectDB(env.mongoUri);
  await Promise.all([User, Project, WorkItem, Comment, Notification, History, RefreshToken].map((m) => m.deleteMany({})));

  /* ---------- users ---------- */
  const passwordHash = await bcrypt.hash(PASSWORD, env.bcryptRounds);
  const mk = (name, email, role) => ({ name, email, role, passwordHash });
  const [admin, maya, marcus, mia, milo, nora, noah] = await User.create([
    mk('Ada Admin', 'admin@tracker.dev', 'ADMIN'),
    mk('Maya Manager', 'manager1@tracker.dev', 'MANAGER'),
    mk('Marcus Manager', 'manager2@tracker.dev', 'MANAGER'),
    mk('Mia Member', 'member1@tracker.dev', 'MEMBER'),
    mk('Milo Member', 'member2@tracker.dev', 'MEMBER'),
    mk('Nora Member', 'member3@tracker.dev', 'MEMBER'),
    mk('Noah Member', 'member4@tracker.dev', 'MEMBER'),
  ]);

  /* ---------- projects ---------- */
  const [web, mobile, tools, legacy] = await Project.create([
    { name: 'Website Revamp', description: 'New marketing site and design system.', owner: maya._id, members: [mia._id, milo._id, nora._id] },
    { name: 'Mobile App', description: 'iOS and Android client for customers.', owner: marcus._id, members: [nora._id, noah._id] },
    { name: 'Internal Tools', description: 'Dashboards and automation for the ops team.', owner: maya._id, members: [milo._id, noah._id] },
    { name: 'Legacy Migration', description: 'Move the old monolith to the new platform.', owner: marcus._id, members: [mia._id], status: 'ARCHIVED' },
  ]);
  const ownerOf = { [web._id]: maya, [mobile._id]: marcus, [tools._id]: maya, [legacy._id]: marcus };

  /* ---------- work items ---------- */
  const T = (title, description, status, priority, project, requester, assignee, due, age) => ({
    type: 'TASK', title, description, status, priority, project: project._id, requester: requester._id,
    assignee: assignee ? assignee._id : null, dueDate: due || null, createdAt: hoursAgo(age), updatedAt: hoursAgo(age / 2),
  });
  const K = (title, description, status, priority, project, requester, assignee, due, age) => ({
    type: 'TICKET', title, description, status, priority, project: project ? project._id : null, requester: requester._id,
    assignee: assignee ? assignee._id : null, dueDate: due || null, createdAt: hoursAgo(age), updatedAt: hoursAgo(age / 2),
    ...(status === 'ESCALATED' ? { escalatedAt: hoursAgo(age / 3) } : {}),
  });

  const items = await WorkItem.create([
    // Website Revamp (Maya)
    T('Design landing page hero', 'Hero section with new brand colours and a clear call to action.', 'IN_PROGRESS', 'HIGH', web, maya, mia, inHours(5), 70),
    T('Set up CI pipeline', 'Lint, test and preview deploys on every pull request.', 'TODO', 'MEDIUM', web, maya, milo, inHours(96), 60),
    T('Write launch copy', 'Headline, subheads and product blurbs for the homepage.', 'IN_REVIEW', 'LOW', web, maya, nora, inHours(48), 55),
    T('Fix broken footer links', 'Several footer links return 404 after the URL restructure.', 'DONE', 'LOW', web, maya, mia, null, 120),
    T('Accessibility audit', 'Run an audit and fix contrast and keyboard issues.', 'TODO', 'HIGH', web, maya, milo, hoursAgo(30), 90),
    T('Cookie banner', 'Add a consent banner that respects regional rules.', 'CANCELLED', 'LOW', web, maya, null, null, 140),
    // Mobile App (Marcus)
    T('Push notification prototype', 'Prototype push notifications for order updates.', 'TODO', 'CRITICAL', mobile, marcus, nora, hoursAgo(20), 80),
    T('Onboarding flow screens', 'Three-step onboarding with skip option.', 'IN_PROGRESS', 'MEDIUM', mobile, marcus, noah, inHours(72), 50),
    T('Crash reporting integration', 'Hook up crash reports and symbol uploads.', 'IN_REVIEW', 'HIGH', mobile, marcus, nora, inHours(30), 40),
    // Internal Tools (Maya)
    T('Weekly ops report automation', 'Generate the weekly ops report and email it on Mondays.', 'IN_PROGRESS', 'MEDIUM', tools, maya, milo, inHours(120), 45),
    T('Admin dashboard charts', 'Add charts for volume and resolution time.', 'TODO', 'LOW', tools, maya, noah, null, 25),
    // Tickets
    K('Cannot reset my password', 'The reset email never arrives.', 'OPEN', 'HIGH', null, mia, null, null, 6),
    K('Site is slow on mobile', 'Pages take 8+ seconds on 4G.', 'IN_PROGRESS', 'MEDIUM', web, milo, mia, null, 30),
    K('Billing page returns 500', 'Opening Billing shows a server error since this morning.', 'ESCALATED', 'CRITICAL', null, nora, maya, null, 12),
    K('Request: dark mode', 'Would love a dark theme in the app.', 'OPEN', 'LOW', mobile, noah, null, null, 18),
    K('Export to CSV broken', 'CSV export downloads an empty file.', 'RESOLVED', 'MEDIUM', tools, milo, noah, null, 100),
    K('Wrong invoice total', 'The invoice total does not match the line items.', 'OPEN', 'MEDIUM', null, mia, null, null, 3),
  ]);
  const byTitle = Object.fromEntries(items.map((i) => [i.title, i]));

  /* ---------- history (activity log) ---------- */
  const actorFor = (i) => (i.project ? ownerOf[i.project] : maya);
  const history = [];
  items.forEach((i) => {
    history.push({ workItem: i._id, actor: i.requester, action: 'CREATED', to: INITIAL_STATUS[i.type], createdAt: i.createdAt });
    if (i.assignee) history.push({ workItem: i._id, actor: actorFor(i)._id, action: 'ASSIGNED', to: i.assignee, createdAt: hoursAgo(1 + (Date.now() - i.createdAt) / 3600000 / 2) });
    if (i.status !== INITIAL_STATUS[i.type]) {
      history.push({
        workItem: i._id, actor: (i.assignee || i.requester), createdAt: i.updatedAt,
        action: i.status === 'ESCALATED' ? 'ESCALATED' : 'STATUS_CHANGED', from: INITIAL_STATUS[i.type], to: i.status,
      });
    }
  });
  await History.create(history);

  /* ---------- comments ---------- */
  await Comment.create([
    { workItem: byTitle['Design landing page hero']._id, author: maya._id, body: 'Please use the new brand colours and keep the hero under 600px tall.', createdAt: hoursAgo(40) },
    { workItem: byTitle['Design landing page hero']._id, author: mia._id, body: 'On it. First draft ready by tomorrow morning.', createdAt: hoursAgo(38) },
    { workItem: byTitle['Write launch copy']._id, author: nora._id, body: 'Draft is ready for review, moved to In review.', createdAt: hoursAgo(20) },
    { workItem: byTitle['Billing page returns 500']._id, author: nora._id, body: 'This blocks every customer from paying, escalating.', createdAt: hoursAgo(5) },
    { workItem: byTitle['Billing page returns 500']._id, author: maya._id, body: 'Looking into it now. Logs show a failing tax-service call.', createdAt: hoursAgo(4) },
    { workItem: byTitle['Cannot reset my password']._id, author: marcus._id, body: 'Can you tell us which email address you used?', createdAt: hoursAgo(2) },
  ]);

  /* ---------- notifications ---------- */
  const notes = [];
  items.forEach((i, idx) => {
    const actor = actorFor(i);
    if (i.assignee && String(i.assignee) !== String(actor._id)) {
      notes.push({ recipient: i.assignee, type: 'ASSIGNED', message: `${actor.name} assigned you "${i.title}"`, entityId: i._id, isRead: idx % 3 === 0, createdAt: hoursAgo(idx + 1) });
    }
    if (i.type === 'TICKET') {
      const recipients = i.project ? [ownerOf[i.project]] : [admin, maya, marcus];
      const requester = [mia, milo, nora, noah].find((u) => String(u._id) === String(i.requester));
      recipients.forEach((r) => notes.push({
        recipient: r._id, type: i.status === 'ESCALATED' ? 'ESCALATED' : 'TICKET_CREATED', entityId: i._id, isRead: false, createdAt: hoursAgo(idx),
        message: i.status === 'ESCALATED' ? `${requester.name} escalated ticket "${i.title}"` : `${requester.name} raised a new ticket "${i.title}"`,
      }));
    }
  });
  notes.push({ recipient: mia._id, type: 'COMMENTED', message: 'Maya Manager commented on "Design landing page hero"', entityId: byTitle['Design landing page hero']._id, isRead: false, createdAt: hoursAgo(40) });
  notes.push({ recipient: nora._id, type: 'DUE_SOON', message: '"Crash reporting integration" is due within 30 hours', entityId: byTitle['Crash reporting integration']._id, isRead: false, createdAt: hoursAgo(1) });
  await Notification.create(notes);

  /* ---------- summary ---------- */
  console.log(`\nSeeded ${items.length} work items in 4 projects. Log in with password: ${PASSWORD}\n`);
  [admin, maya, marcus, mia, milo, nora, noah].forEach((u) => console.log(`  ${u.role.padEnd(8)} ${u.email.padEnd(24)} ${u.name}`));
  console.log('\nThe running API picks the new data up immediately; just log in again.');
  await mongoose.disconnect();
}

seed().catch((e) => { console.error(e); process.exit(1); });
