const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../constants/roles');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const signAccess = (user) => jwt.sign({ sub: String(user._id) }, env.jwtAccessSecret, { expiresIn: env.jwtAccessExpiresIn });

async function issueTokens(user) {
  const refreshToken = crypto.randomBytes(40).toString('hex');
  await RefreshToken.create({
    user: user._id,
    tokenHash: sha256(refreshToken),
    expiresAt: new Date(Date.now() + env.refreshTokenDays * 86400000),
  });
  return { accessToken: signAccess(user), refreshToken };
}

async function register({ name, email, password }) {
  if (await User.exists({ email })) throw ApiError.conflict('Email is already registered');
  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
  const user = await User.create({ name, email, passwordHash, role: ROLES.MEMBER });
  return { user, ...(await issueTokens(user)) };
}

async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw ApiError.unauthorized('Invalid email or password'); // same message for both cases
  if (!user.isActive) throw ApiError.forbidden('This account has been deactivated');
  return { user, ...(await issueTokens(user)) };
}

// Rotating refresh tokens with reuse detection: replaying a revoked token kills all sessions.
async function refresh(rawToken) {
  if (!rawToken) throw ApiError.unauthorized('Missing refresh token');
  const stored = await RefreshToken.findOne({ tokenHash: sha256(rawToken) });
  if (!stored || stored.expiresAt < new Date()) throw ApiError.unauthorized('Invalid refresh token');
  if (stored.revokedAt) {
    await RefreshToken.updateMany({ user: stored.user, revokedAt: null }, { revokedAt: new Date() });
    throw ApiError.unauthorized('Refresh token reuse detected, please log in again');
  }
  const user = await User.findById(stored.user);
  if (!user || !user.isActive) throw ApiError.unauthorized('Account not available');
  stored.revokedAt = new Date();
  await stored.save();
  return { user, ...(await issueTokens(user)) };
}

async function logout(rawToken) {
  if (!rawToken) return;
  await RefreshToken.updateOne({ tokenHash: sha256(rawToken), revokedAt: null }, { revokedAt: new Date() });
}

const revokeAllForUser = (userId) => RefreshToken.updateMany({ user: userId, revokedAt: null }, { revokedAt: new Date() });

module.exports = { register, login, refresh, logout, revokeAllForUser };
