# Tracker API (Express + MongoDB + Socket.IO)

```bash
cp .env.example .env      # set MONGO_URI and JWT_ACCESS_SECRET
npm install
npm run seed              # demo users/projects/items (password: Password@123)
npm run dev               # http://localhost:5000
npm test                  # Jest + supertest + in-memory MongoDB
npm run postman           # regenerates postman/tracker.postman_collection.json
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


## Layers
`routes -> validate (Zod) -> authenticate/authorize -> controller -> service -> model`. Business rules live in `services/`, permission rules in `policies/`, status rules in `constants/statuses.js`.

## Authorization (all enforced server-side)
1. **Route level**: `authorize('ADMIN')` etc.
2. **Query level**: `buildVisibilityFilter(user)` is merged into every work-item query. Invisible items return **404**; visible-but-forbidden actions return **403**.
3. **Field level**: assignees may change only `status` and `description`; managers/admins may change everything.

| Role | Sees | Can do |
|---|---|---|
| Admin | everything | users/roles, all projects/items, delete items, `GET /notifications?scope=all` |
| Manager | projects they own or belong to, own/assigned items, project-less tickets | create/manage own projects, add members, create tasks, assign to project members, change status/priority |
| Member | items in their projects, raised by or assigned to them | raise tickets, update assigned items (status/description), comment |

## Status transitions
See `src/constants/statuses.js` (single source of truth, unit-tested). Invalid moves return `422` with the list of allowed next statuses. `GET /work-items/:id` returns a `permissions` block (`editableFields`, `allowedNextStatuses`, `canEscalate`, `canDelete`) so the UI never re-implements rules.

## Realtime
Connect with `io(URL, { auth: { token: accessToken } })`. Invalid tokens are rejected. Events: `notification:new` (to the recipient's room), `notification:audit` (admins). Notifications are saved first, then emitted, so a missed event is recovered by `GET /notifications`.

## Trade-offs worth mentioning in the interview
- Soft delete for work items; projects are archived, users deactivated.
- Search is an escaped case-insensitive regex (substring match) instead of a Mongo text index: friendlier for partial words, fine at this scale.
- Refresh tokens are opaque, hashed in DB, rotated, with reuse detection.
- Sockets verify the token once at handshake; role change/deactivation force-disconnects the user.
- Scaling out: add `@socket.io/redis-adapter` (not built).
