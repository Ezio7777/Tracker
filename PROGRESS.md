# PROGRESS.md - read this FIRST when resuming (saves re-reading all code)

**Project:** Unified Team Task & Support Ticket Tracker (MERN take-home, JavaScript only).
**Stack:** server = Express 4 + Mongoose 8 + Socket.IO + Zod + bcrypt + JWT (CommonJS). client = Next.js App Router (JS).
**Last updated:** 2026-11-23 (client phase complete)

## Status
| Area | State |
|---|---|
| Server (models, validators, middleware, policies, services, controllers, routes, sockets, cron, seed) | DONE (written, syntax-checked; **not yet run** - no network in the build sandbox) |
| Tests (auth, rbac, transitions) in `server/tests` | DONE, **not yet run** -> run `npm i && npm test` and fix anything red |
| Postman | DONE (`server/postman/generate.js` -> `tracker.postman_collection.json`) |
| Server README | DONE |
| Client (Next.js) | DONE (33 files, JSX syntax-checked with tsc; **not yet run** - needs `npm i && npm run dev`) |
| Root README + client README | DONE |
| Remaining | run everything end to end, fix any runtime bugs, optional screenshots, deploy (Render/Atlas + Vercel) |

## Resume instructions
1. Read this file only. Open specific source files only when a task needs them.
2. If tests/run fail, paste the error; fix the named file only.
3. Next = integration/debug pass (run server tests, run both apps, click through each role), then deploy. Do not re-read all code; open only files named in an error.

## Conventions (server)
- Response shapes: `{ data }`, lists `{ data, meta:{ total,page,limit,pages } }`, errors `{ error:{ message, details } }`. Delete/logout = 204.
- Auth: `Authorization: Bearer <access>`; refresh token = httpOnly cookie `rt` (path `/auth`), rotated by `POST /auth/refresh`. Client must call fetch with `credentials:'include'`.
- 404 = item invisible to caller; 403 = visible but forbidden; 422 = invalid status transition (details.allowed lists legal next states).
- Public register always creates MEMBER. Admin only via seed / `PATCH /users/:id/role`.
- Use `user._id` (ObjectId) in Mongo filters, `sameId()` from `utils/ids.js` for comparisons.

## Key files
- `src/constants/statuses.js` transition map + `canTransition` (single source of truth)
- `src/policies/workItemPolicy.js` visibility filter + update scope (FULL | ASSIGNEE | null) and field lists
- `src/services/workItemService.js` all work-item rules; `publish()` = history + notifications
- `src/services/notificationService.js` persist then emit `notification:new` to room `user:<id>` (+ `notification:audit` to `role:ADMIN`)
- `src/sockets/index.js` handshake auth (`auth.token`), rooms, `disconnectUser`
- `src/jobs/dueSoon.job.js` cron every 15 min, dedupe via `dueSoonNotifiedAt`

## Rules decided (differ slightly from the first design message)
- Search = escaped regex on title/description (no text index).
- Members may set `priority` when raising a ticket but not assignee/dueDate.
- Assignee fields: `status`, `description` only. Staff (FULL): title, description, status, priority, assignee, dueDate. Project is not editable after creation.
- CANCELLED/CLOSED items are locked. RESOLVED->OPEN (reopen), DONE->IN_PROGRESS, cancel, close = staff only.
- Managers see projects they own OR belong to, plus project-less tickets (triage queue).
- Removing a project member with open assigned items -> 409.

## API contract (for the client)
```
POST /auth/register|login -> {data:{user,accessToken}}   POST /auth/refresh   POST /auth/logout   GET /auth/me
GET /users?role=&q=&page=            (ADMIN full, MANAGER picker: name,email,role)
PATCH /users/:id/role {role}   PATCH /users/:id/status {isActive}    (ADMIN)
POST /projects {name,description}   GET /projects?status=&q=&page=   GET|PATCH /projects/:id
POST /projects/:id/members {userId}   DELETE /projects/:id/members/:userId
POST /work-items {type,title,description?,priority?,project?,assignee?,dueDate?}
GET  /work-items?status&type&priority&project&assignee(me|id)&requester(me|id)&q&dueBefore&sortBy&order&page&limit
GET  /work-items/:id  -> item + permissions{editScope,editableFields,allowedNextStatuses,canEscalate,canDelete}
PATCH /work-items/:id   DELETE /work-items/:id (admin, soft)   POST /work-items/:id/escalate   GET /work-items/:id/history
POST|GET /work-items/:id/comments  {body}
GET /notifications?unread=true&scope=me|all&page=   GET /notifications/unread-count   PATCH /notifications/:id/read   PATCH /notifications/read-all
GET /dashboard/summary -> {total,byType,byStatus,overdue,myOpen,unreadNotifications}
Socket: io(URL,{auth:{token}}) events: 'ready', 'notification:new'
```
Seed logins (password `Password@123`): admin@tracker.dev, manager1@tracker.dev, manager2@tracker.dev, member1..3@tracker.dev

## Client layout (BUILT)
Files: `src/lib/api.js` (fetch wrapper, in-memory access token, auto-refresh on 401), `src/lib/socket.js`, `src/context/AuthContext.js`, `SocketContext.js`.
Pages: `(auth)/login`, `register`; `(app)/layout.js` (auth guard, role-based navbar, notification bell); `dashboard`; `projects` + `[id]`; `work-items` (filters, pagination) + `[id]` (comments, history timeline, status dropdown from `permissions.allowedNextStatuses`, escalate) + `new`; `admin/users`.
Components: Navbar, NotificationBell, NotificationPanel, WorkItemTable, WorkItemFilters, WorkItemForm, CommentSection, StatusBadge, Spinner, ErrorBox.
Env: `NEXT_PUBLIC_API_URL`.

## Change log
- 2026-11-23: server + tests + Postman + READMEs written.
- 2026-11-23: client built (api.js auto-refresh, Auth/Socket contexts, bell + toast, all pages, role-aware forms), READMEs added.

## Client notes
- `lib/api.js` in-memory token + shared refresh; `lib/useAsync.js` data hook (reload() = silent refetch); `lib/useAssigneeOptions.js` mirrors server assignee rule.
- Detail/list/dashboard pages refetch when `useNotifications().last` changes (live updates).
- Pages with `searchParams` prop: work-items (initial `project` filter) and work-items/new (`project` preselect).
- Known gaps (nice-to-have): history shows "changed the assignee" without names; no pagination on comments (limit 100); no tests for client.
