const { Client } = require('pg');

// Creates the database named in the connection string if it does not exist yet.
// Connects to the built-in "postgres" database to do that.
async function ensureDatabase(connectionString, ssl) {
  const url = new URL(connectionString);
  const dbName = decodeURIComponent(url.pathname.slice(1));
  url.pathname = '/postgres';

  const admin = new Client({ connectionString: url.toString(), ssl });
  await admin.connect();
  try {
    const found = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (found.rowCount > 0) return false;
    await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
    return true;
  } finally {
    await admin.end();
  }
}

module.exports = { ensureDatabase };
