// One command for a fresh machine: create the database if needed, then run migrations.
// Usage: npm run db:setup
const env = require('../config/env');
const { ensureDatabase } = require('./ensureDatabase');
const { migrate } = require('./migrate');
const { pool } = require('./pool');

(async () => {
  try {
    const created = await ensureDatabase(env.databaseUrl, env.databaseSsl ? { rejectUnauthorized: false } : undefined);
    console.log(created ? 'Created the database.' : 'Database already exists.');
  } catch (err) {
    // Hosted databases often do not allow CREATE DATABASE; that is fine if it already exists.
    console.log(`Skipped creating the database (${err.message}). Continuing with migrations.`);
  }
  try {
    await migrate();
    console.log('Database is up to date.');
    await pool.end();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
})();
