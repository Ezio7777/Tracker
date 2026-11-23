const asyncHandler = require('../utils/asyncHandler');
const commentService = require('../services/commentService');

exports.add = asyncHandler(async (req, res) =>
  res.status(201).json({ data: await commentService.add(req.user, req.params.id, req.body.body) }));
exports.list = asyncHandler(async (req, res) => res.json(await commentService.list(req.user, req.params.id, req.query)));
