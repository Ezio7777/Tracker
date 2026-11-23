const http = require('http');
const mongoose = require('mongoose');
const env = require('./config/env');
const connectDB = require('./config/db');
const app = require('./app');
const { initSocket } = require('./sockets');
const { startDueSoonJob } = require('./jobs/dueSoon.job');

async function main() {
  await connectDB(env.mongoUri);
  const server = http.createServer(app);
  initSocket(server);
  if (env.enableCron) startDueSoonJob();
  server.listen(env.port, () => console.log(`API + Socket.IO listening on :${env.port} (${env.nodeEnv})`));

  const shutdown = () => server.close(async () => { await mongoose.disconnect(); process.exit(0); });
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => { console.error('Failed to start', err); process.exit(1); });
