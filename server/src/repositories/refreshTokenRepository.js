const { query, queryOne, pool } = require('../db/pool');

const insert = ({ userId, tokenHash, expiresAt }) =>
  queryOne(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3) RETURNING *',
    [userId, tokenHash, expiresAt]
  );

const findByHash = (tokenHash) => queryOne('SELECT * FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);

const revoke = (id) => query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL', [id]);

const revokeByHash = (tokenHash) =>
  query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [tokenHash]);

const revokeAllForUser = (userId) =>
  query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);

// Housekeeping: expired tokens are useless, so the daily cleanup job removes them.
const deleteExpired = async () => (await pool.query('DELETE FROM refresh_tokens WHERE expires_at < now()')).rowCount;

module.exports = { insert, findByHash, revoke, revokeByHash, revokeAllForUser, deleteExpired };
