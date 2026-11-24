const jwt = require('jsonwebtoken');
const env = require('../config/env');
const userRepository = require('../repositories/userRepository');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// The user (and their role) is loaded from the database on every request,
// so role changes and deactivation take effect immediately.
module.exports = asyncHandler(async (req, _res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw ApiError.unauthorized('Missing access token');

  let payload;
  try {
    payload = jwt.verify(token, env.jwtAccessSecret);
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }
  const user = await userRepository.findById(payload.sub);
  if (!user || !user.isActive) throw ApiError.unauthorized('Account not available');
  req.user = user;
  next();
});
