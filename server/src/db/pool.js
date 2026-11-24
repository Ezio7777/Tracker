const { Pool } = require('pg');
const env = require('../config/env');

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
});

// Columns come back as snake_case; the rest of the app works with camelCase.
const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const camelizeRow = (row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [camel(k), v]));

// Every query in the app goes through here with $1, $2 ... placeholders (never string concatenation of user input).
// `db` can be the pool or a transaction client, so repositories work in both cases.
async function query(text, params = [], db = pool) {
  const result = await db.query(text, params);
  return result.rows.map(camelizeRow);
}

async function queryOne(text, params = [], db = pool) {
  const rows = await query(text, params, db);
  return rows[0] || null;
}

// Runs fn inside BEGIN/COMMIT and rolls back if anything throws.
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, queryOne, withTransaction };
