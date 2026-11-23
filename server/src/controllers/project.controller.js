const asyncHandler = require('../utils/asyncHandler');
const projectService = require('../services/projectService');

exports.create = asyncHandler(async (req, res) => res.status(201).json({ data: await projectService.create(req.user, req.body) }));
exports.list = asyncHandler(async (req, res) => res.json(await projectService.list(req.user, req.query)));
exports.getOne = asyncHandler(async (req, res) => res.json({ data: await projectService.getOne(req.user, req.params.id) }));
exports.update = asyncHandler(async (req, res) => res.json({ data: await projectService.update(req.user, req.params.id, req.body) }));
exports.addMember = asyncHandler(async (req, res) =>
  res.json({ data: await projectService.addMember(req.user, req.params.id, req.body.userId) }));
exports.removeMember = asyncHandler(async (req, res) =>
  res.json({ data: await projectService.removeMember(req.user, req.params.id, req.params.userId) }));
