const asyncHandler = require('../utils/asyncHandler');
const userService = require('../services/userService');

exports.list = asyncHandler(async (req, res) => res.json(await userService.list(req.user, req.query)));
exports.updateRole = asyncHandler(async (req, res) =>
  res.json({ data: await userService.updateRole(req.user, req.params.id, req.body.role) }));
exports.updateStatus = asyncHandler(async (req, res) =>
  res.json({ data: await userService.updateStatus(req.user, req.params.id, req.body.isActive) }));
