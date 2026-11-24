const http = require('http');
const env = require('./config/env');
const { pool } = require('./db/pool');
const app = require('./app');
const { initSocket } = require('./sockets');
const { startDueSoonJob } = require('./jobs/dueSoon.job');
const { startCleanupJob } = require('./jobs/cleanup.job');

async function main() {
  await pool.query('SELECT 1'); // fail fast if the database is not reachable
  console.log('PostgreSQL connected');

  const server = http.createServer(app);
  initSocket(server);
  if (env.enableCron) {
    startDueSoonJob();
    startCleanupJob();
  }
  server.listen(env.port, () => console.log(`API + Socket.IO listening on :${env.port} (${env.nodeEnv})`));

  const shutdown = () => server.close(async () => { await pool.end(); process.exit(0); });
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Failed to start. Is PostgreSQL running and migrated? (npm run db:setup)\n', err.message);
  process.exit(1);
});
