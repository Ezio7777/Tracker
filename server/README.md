# Server

Express API with PostgreSQL and Socket.IO. Setup, environment variables and demo logins are in the [main README](../README.md). The reasoning behind the design is in [DESIGN.md](../DESIGN.md).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the API with auto reload |
| `npm start` | Start the API |
| `npm run db:setup` | Create the database if needed and run migrations |
| `npm run migrate` | Run pending migrations only |
| `npm run seed` | Run migrations, empty all tables, load demo data |
| `npm test` | Run the tests (needs PostgreSQL, see main README) |
| `npm run postman` | Rebuild `postman/tracker.postman_collection.json` |

## Where things are

```
migrations/          SQL schema files, applied in order
src/routes/          URL -> middleware -> controller
src/controllers/     read the request, call a service, send the response
src/services/        business rules (who may do what, transitions, notifications)
src/repositories/    all SQL lives here
src/policies/        access rules (what a user may see / change)
src/constants/       roles, statuses and the allowed status transitions
src/db/              connection pool, migration runner, database setup
src/sockets/         authenticated Socket.IO server
src/jobs/            due-soon reminders and nightly cleanup
src/seed/            demo data
tests/               auth, access control, transitions, database constraints
```

## Main endpoints

```
POST  /auth/register  /auth/login  /auth/refresh  /auth/logout        GET /auth/me
GET   /users   PATCH /users/:id/role   PATCH /users/:id/status        (admin / manager picker)
POST  /projects   GET /projects   GET|PATCH /projects/:id
POST  /projects/:id/members   DELETE /projects/:id/members/:userId
POST  /work-items   GET /work-items   GET|PATCH|DELETE /work-items/:id
POST  /work-items/:id/escalate   GET /work-items/:id/history
POST|GET /work-items/:id/comments
GET   /notifications   GET /notifications/unread-count
PATCH /notifications/:id/read   PATCH /notifications/read-all
GET   /dashboard/summary
```

`GET /work-items` accepts `status, type, priority, project, assignee (me or id), requester (me or id), q, dueBefore, sortBy, order, page, limit`. It only ever returns what the logged-in user is allowed to see.

Socket.IO: connect with `io(url, { auth: { token } })`. Events: `ready`, `notification:new`.
