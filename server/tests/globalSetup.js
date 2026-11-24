// Runs once before all tests: make sure the test database exists and has the latest schema.
module.exports = async () => {
  require('./testEnv');
  const { ensureDatabase } = require('../src/db/ensureDatabase');
  const { migrate } = require('../src/db/migrate');
  const { pool } = require('../src/db/pool');
  try {
    await ensureDatabase(process.env.DATABASE_URL);
    await migrate({ log: () => {} });
  } catch (err) {
    throw new Error(
      `Could not prepare the test database (${err.message}).\n` +
      'Is PostgreSQL running? Try "docker compose up -d" in the project root, or set TEST_DATABASE_URL.'
    );
  } finally {
    await pool.end();
  }
};
