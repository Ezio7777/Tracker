# Tracker client (Next.js App Router, JavaScript)

```bash
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:5000
npm install
npm run dev                  # http://localhost:3000
```

- **Auth:** access token kept in memory only; refresh token is an httpOnly cookie (`credentials: 'include'`). `lib/api.js` refreshes once on 401 and retries; concurrent refreshes share one request.
- **Realtime:** `context/SocketContext.js` loads notifications from the API, then listens to `notification:new`. The socket `auth` option is a function, so reconnects always send a fresh token.
- **Rules live on the server.** `GET /work-items/:id` returns `permissions` (editable fields, allowed next statuses, escalate/delete flags) and the UI only renders what is allowed.
- **Pages:** login, register, dashboard, projects (+detail), work items (filters, pagination, sorting), new item, work item detail (comments, activity timeline, live refresh), admin users.
