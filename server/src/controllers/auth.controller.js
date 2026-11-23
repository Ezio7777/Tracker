const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/authService');

const cookieOptions = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: env.cookieSameSite,
  path: '/auth',
  maxAge: env.refreshTokenDays * 86400000,
};

const respond = (res, status, { user, accessToken, refreshToken }) => {
  res.cookie('rt', refreshToken, cookieOptions);
  res.status(status).json({ data: { user, accessToken } });
};

exports.register = asyncHandler(async (req, res) => respond(res, 201, await authService.register(req.body)));
exports.login = asyncHandler(async (req, res) => respond(res, 200, await authService.login(req.body)));
exports.refresh = asyncHandler(async (req, res) => respond(res, 200, await authService.refresh(req.cookies.rt)));
exports.logout = asyncHandler(async (req, res) => {
  await authService.logout(req.cookies.rt);
  res.clearCookie('rt', { ...cookieOptions, maxAge: undefined });
  res.status(204).end();
});
exports.me = asyncHandler(async (req, res) => res.json({ data: req.user }));
