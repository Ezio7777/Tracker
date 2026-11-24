# Task & Ticket Tracker

A small full-stack app where a team manages project tasks and support tickets in one place. It has roles (admin, manager, member), projects, comments, and notifications that arrive in real time.

- **Frontend:** Next.js (App Router), plain JavaScript
- **Backend:** Express
- **Database:** PostgreSQL (plain SQL migrations, queries through `pg`)
- **Realtime:** Socket.IO
- **Auth:** JWT access token plus a rotating refresh token, passwords hashed with bcrypt

I wrote down why I made the main design choices in [DESIGN.md](DESIGN.md). The API collection for Postman is in `server/postman/`.

## Folders

```
server/    the API: routes, controllers, services, repositories (SQL), migrations, seed, tests
client/    the Next.js app
docker/    init script for the test database
DESIGN.md  database design, access control, notifications, trade-offs
```

## Getting it running

You need Node.js 18 or newer and PostgreSQL 13 or newer. The easiest way to get PostgreSQL is Docker:

```bash
docker compose up -d        # starts PostgreSQL on port 5432
```

If you already have PostgreSQL installed, skip that and put your own connection string in `server/.env`.

**1. Backend**

```bash
cd server
cp .env.example .env        # open it and set JWT_ACCESS_SECRET to any long random text
npm install
npm run db:setup            # creates the database if needed and runs the migrations
npm run seed                # optional: fills it with demo data
npm run dev                 # API on http://localhost:5000
```

**2. Frontend** (in a second terminal)

```bash
cd client
cp .env.example .env.local
npm install
npm run dev                 # app on http://localhost:3000
```

## Environment variables

`server/.env`

| Variable | Needed | Default | What it does |
|---|---|---|---|
| `DATABASE_URL` | yes | none | PostgreSQL connection string, for example `postgres://tracker:tracker@localhost:5432/tracker` |
| `JWT_ACCESS_SECRET` | yes | none | Secret used to sign access tokens. Use a long random string. |
| `DATABASE_SSL` | no | `false` | Set to `true` for hosted databases that require SSL |
| `PORT` | no | `5000` | API port |
| `NODE_ENV` | no | `development` | In `production` cookies are `secure` and error details are hidden |
| `JWT_ACCESS_EXPIRES_IN` | no | `15m` | How long an access token lives |
| `REFRESH_TOKEN_DAYS` | no | `7` | How long a refresh token lives |
| `CLIENT_ORIGIN` | no | `http://localhost:3000` | Allowed origin for CORS and Socket.IO (comma separated for several) |
| `COOKIE_SAMESITE` | no | `lax` | Use `none` (with HTTPS) if the API and the UI are on different sites |
| `BCRYPT_ROUNDS` | no | `10` | bcrypt cost factor |
| `DUE_SOON_HOURS` | no | `24` | How early the "due soon" reminder is sent |
| `ENABLE_CRON` | no | `true` | Set to `false` to turn off the background jobs |

`client/.env.local` only needs `NEXT_PUBLIC_API_URL` (default `http://localhost:5000`).

## Database setup and migrations

The schema lives in plain SQL files in `server/migrations/`. A tiny runner (`server/src/db/migrate.js`) applies the files in order and records each one in a `schema_migrations` table, so running it again is safe.

| Command (run inside `server/`) | What it does |
|---|---|
| `npm run db:setup` | Creates the database if it does not exist, then runs the migrations |
| `npm run migrate` | Only runs pending migrations |
| `npm run seed` | Runs migrations, **empties every table**, and loads the demo data |

To change the schema later, add a new file such as `002_something.sql`. Do not edit an old one once it has been applied.

## Demo logins

After `npm run seed`, every account uses the password **`Password@123`**.

| Role | Email | What they see |
|---|---|---|
| Admin | admin@tracker.dev | everything, user management, delete items, all notifications |
| Manager | manager1@tracker.dev | manages *Website Revamp* and *Internal Tools* |
| Manager | manager2@tracker.dev | manages *Mobile App* and the archived *Legacy Migration* |
| Member | member1@tracker.dev | Website Revamp (and the archived Legacy project) |
| Member | member2@tracker.dev | Website Revamp, Internal Tools |
| Member | member3@tracker.dev | Website Revamp, Mobile App |
| Member | member4@tracker.dev | Mobile App, Internal Tools |

Seeding deletes accounts you created by hand, so log in with the ones above afterwards.

## Tests

```bash
cd server
npm test
```

The tests use a separate database called `tracker_test` (created automatically; with Docker it already exists). They cover login and registration, role-based access (who can see and change what), status transitions, and the database constraints. Set `TEST_DATABASE_URL` if your PostgreSQL is not the one from `docker-compose.yml`.

## Trying the main flow

1. Log in as `manager1@tracker.dev`, open **Projects**, create a project and add members.
2. Create a task in that project and assign it to a member.
3. Open a private window and log in as `member1@tracker.dev`. The bell shows the new notification straight away, no refresh.
4. As the member, open the task and change its status. Only valid next steps are offered.
5. Comment from both sides. Each side gets a notification.
6. As any user choose **Raise ticket**. As manager or admin, assign or escalate it.
7. Log out and back in: unread and older notifications are still there under **Notifications**. The admin also has an "Everyone" tab.

## API in Postman

Import `server/postman/tracker.postman_collection.json`. Log in first (the login requests save the token for you), then go through the folders in order. The last folder contains requests that should be rejected for a member. Run `npm run postman` in `server/` to regenerate the file.

## Deploying

Set `CLIENT_ORIGIN` on the API and `NEXT_PUBLIC_API_URL` on the client. If they live on different sites, use HTTPS and `COOKIE_SAMESITE=none`. For a hosted database set `DATABASE_SSL=true`. Running more than one API instance needs the Socket.IO Redis adapter, which I have not added.
