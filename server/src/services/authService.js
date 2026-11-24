const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const userRepository = require('../repositories/userRepository');
const refreshTokenRepository = require('../repositories/refreshTokenRepository');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../constants/roles');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const signAccess = (user) => jwt.sign({ sub: user.id }, env.jwtAccessSecret, { expiresIn: env.jwtAccessExpiresIn });

async function issueTokens(user) {
  const refreshToken = crypto.randomBytes(40).toString('hex');
  await refreshTokenRepository.insert({
    userId: user.id,
    tokenHash: sha256(refreshToken), // only the hash is stored
    expiresAt: new Date(Date.now() + env.refreshTokenDays * 86400000),
  });
  return { accessToken: signAccess(user), refreshToken };
}

async function register({ name, email, password }) {
  if (await userRepository.emailExists(email)) throw ApiError.conflict('Email is already registered');
  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
  const user = await userRepository.insert({ name, email, passwordHash, role: ROLES.MEMBER }); // signup is always a member
  return { user, ...(await issueTokens(user)) };
}

async function login({ email, password }) {
  const found = await userRepository.findByEmailWithHash(email);
  const ok = found && (await bcrypt.compare(password, found.passwordHash));
  if (!ok) throw ApiError.unauthorized('Invalid email or password'); // same message whether the email or the password was wrong
  if (!found.isActive) throw ApiError.forbidden('This account has been deactivated');
  const { passwordHash, ...user } = found;
  return { user, ...(await issueTokens(user)) };
}

// Refresh tokens are single use. If an old one is replayed, someone probably copied it,
// so every session of that user is revoked.
async function refresh(rawToken) {
  if (!rawToken) throw ApiError.unauthorized('Missing refresh token');
  const stored = await refreshTokenRepository.findByHash(sha256(rawToken));
  if (!stored || stored.expiresAt < new Date()) throw ApiError.unauthorized('Invalid refresh token');
  if (stored.revokedAt) {
    await refreshTokenRepository.revokeAllForUser(stored.userId);
    throw ApiError.unauthorized('Refresh token reuse detected, please log in again');
  }
  const user = await userRepository.findById(stored.userId);
  if (!user || !user.isActive) throw ApiError.unauthorized('Account not available');
  await refreshTokenRepository.revoke(stored.id);
  return { user, ...(await issueTokens(user)) };
}

async function logout(rawToken) {
  if (rawToken) await refreshTokenRepository.revokeByHash(sha256(rawToken));
}

const revokeAllForUser = (userId) => refreshTokenRepository.revokeAllForUser(userId);

module.exports = { register, login, refresh, logout, revokeAllForUser };
