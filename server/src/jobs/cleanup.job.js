const cron = require('node-cron');
const notificationRepository = require('../repositories/notificationRepository');
const refreshTokenRepository = require('../repositories/refreshTokenRepository');

const KEEP_NOTIFICATION_DAYS = 90;

// Postgres has no "expire after N days" setting, so a small nightly job does the housekeeping.
async function runCleanup() {
  const notifications = await notificationRepository.deleteOlderThan(KEEP_NOTIFICATION_DAYS);
  const tokens = await refreshTokenRepository.deleteExpired();
  return { notifications, tokens };
}

function startCleanupJob() {
  cron.schedule('0 3 * * *', () => runCleanup().catch((err) => console.error('cleanup job failed', err)));
}

module.exports = { runCleanup, startCleanupJob };
