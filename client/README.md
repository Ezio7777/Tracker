# Unified Team Task & Support Ticket Tracker

MERN-style full-stack app (JavaScript only): **Next.js** + **Express** + **MongoDB/Mongoose** + **Socket.IO**, JWT auth with refresh-token rotation, backend-enforced RBAC.

```
server/   Express API, Socket.IO, cron, seed, Jest tests, Postman collection   (see server/README.md)
client/   Next.js App Router UI                                               (see client/README.md)
```

## Demo logins (after `npm run seed`, password for all: `Password@123`)
| Role | Email | What they see |
|---|---|---|
| Admin | admin@tracker.dev | everything, user management, delete items |
| Manager | manager1@tracker.dev | owns *Website Revamp* and *Internal Tools* |
| Manager | manager2@tracker.dev | owns *Mobile App* and the archived *Legacy Migration* |
| Member | member1@tracker.dev | member of Website Revamp (+ archived Legacy) |
| Member | member2@tracker.dev | Website Revamp, Internal Tools |
| Member | member3@tracker.dev | Website Revamp, Mobile App |
| Member | member4@tracker.dev | Mobile App, Internal Tools |

`npm run seed` wipes the database first (including accounts you registered by hand).

## Quick start
```bash
# 1. API
cd server && cp .env.example .env && npm install && npm run seed && npm run dev
# 2. UI (new terminal)
cd client && cp .env.example .env.local && npm install && npm run dev
```
Open http://localhost:3000 and sign in (password `Password@123`):
`admin@tracker.dev`, `manager1@tracker.dev`, `member1@tracker.dev` (more in server/README.md).

## Try this in a demo
1. Log in as **member1** in one window and **manager1** in another (private window).
2. Manager assigns a task to the member: the member's bell lights up instantly (Socket.IO) and the notification is stored in the DB.
3. Member changes status along valid transitions only; try an invalid one via Postman and see the 422.
4. Member opens another project's item by id: 404. Calls an admin endpoint: 403.

## Highlights
- Visibility enforced in the Mongo query itself, so pagination and counts are always correct
- Field-level rules (assignees can only change status/description), valid status transitions per type, soft delete
- Notifications persisted first, then emitted; authenticated sockets; unread state; due-soon cron
- Activity log / status and assignment history on every work item, dashboard counts, ticket escalation
- Unit + integration tests for auth, RBAC and transitions (`cd server && npm test`)

## Deployment notes
Set `CLIENT_ORIGIN` on the API and `NEXT_PUBLIC_API_URL` on the client. For cross-site hosting use HTTPS with `COOKIE_SAMESITE=none`. Multiple API instances need `@socket.io/redis-adapter` (documented, not built).
