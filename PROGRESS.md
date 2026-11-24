# PROGRESS.md - read this first when resuming

**Project:** Task & Ticket Tracker for the AXS Jr. Fullstack assignment. **Deadline: end of day 25 Nov 2026.**
**Stack:** Next.js (JS, App Router) + Express + **PostgreSQL** (`pg`, plain SQL migrations) + Socket.IO + Zod + bcrypt + JWT.
(The project started on MongoDB and was fully migrated to PostgreSQL on 2026-11-23.)

## State
| Area | State |
|---|---|
| Server (migrations, repositories, services, policies, routes, sockets, jobs, seed) | written, JS syntax-checked, **not run yet** (no Postgres/network in the build sandbox) |
| Tests: auth, rbac, transitions, db constraints | written, **not run yet** |
| Client (all pages, notifications page, soft UI) | written, JSX syntax-checked, **not run yet** |
| README.md, DESIGN.md, server/README.md, docker-compose.yml, Postman | done |

## Before submitting
1. `docker compose up -d`
2. `cd server && cp .env.example .env && npm install && npm run db:setup && npm test` (fix anything red; paste the error to continue)
3. `npm run seed && npm run dev`, then `cd ../client && cp .env.example .env.local && npm install && npm run dev`
4. Click through the flow in two browser windows (manager1 + member1, password `Password@123`)
5. `npm run postman`, push to GitHub (no `.env`, no `node_modules`)

## Architecture
`route -> validate (Zod) -> authenticate/authorize -> controller -> service -> repository (SQL) -> PostgreSQL`
- `server/migrations/001_init.sql` all tables, CHECKs, FKs, partial indexes, `updated_at` trigger
- `server/src/db/pool.js` pool, `query/queryOne` (camelCases rows), `withTransaction`; `migrate.js`, `setup.js`, `ensureDatabase.js`
- `server/src/repositories/*` ALL SQL (users, projects, workItems, comments, notifications, history, refreshTokens)
- `server/src/policies/workItemPolicy.js` `visibilitySql(user, add)` (row-level WHERE) + `getUpdateScope` (FULL | ASSIGNEE | null)
- `server/src/services/workItemService.js` rules, transactions (`SELECT ... FOR UPDATE`), history + notifications
- `notificationService`: `create(..., tx)` inside the transaction, `deliver(rows)` AFTER commit (Socket.IO rooms `user:<id>`, `role:ADMIN`)
- `server/src/constants/statuses.js` transition map (unit tested)
- jobs: due-soon (every 15 min), cleanup (nightly: notifications > 90 days, expired refresh tokens)

## Conventions
- IDs are UUID strings: JSON uses `id` (not `_id`). Project has `manager` (not owner) + `managerId`. Priority is `LOW|MEDIUM|HIGH|URGENT`.
- Responses: `{ data }`, lists `{ data, meta:{total,page,limit,pages} }`, errors `{ error:{ message, details } }`.
- 404 = not visible to caller, 403 = visible but not allowed, 422 = invalid status transition (details.allowed).
- Postgres errors mapped in `middleware/errorHandler.js` (23505 -> 409, 23503 -> 409, 23514 -> 400, 22P02 -> 400).
- Members may only POST comments on items assigned to / raised by them (`permissions.canComment`).
- Public register always creates MEMBER. Seed wipes the DB. Demo logins are in README.md.

## Client notes
`lib/api.js` (in-memory access token, shared refresh), `lib/useAsync.js`, `context/SocketContext.js` (loads from API, then live events), pages use `permissions` from `GET /work-items/:id`. Styling in `app/globals.css` (design tokens, `.pip` status dot, ripple buttons).

## Change log
- 2026-11-23: backend + client built on MongoDB, UI redesign, spec alignment (URGENT, comment rule, notifications page, DESIGN.md).
- 2026-11-23: **migrated MongoDB -> PostgreSQL**: new schema + migration runner, repository layer, transactional services, UUID ids, tests incl. constraint tests, seed, docs, docker-compose (Postgres + test DB).
