const asyncHandler = require('../utils/asyncHandler');
const svc = require('../services/workItemService');

exports.create = asyncHandler(async (req, res) => res.status(201).json({ data: await svc.create(req.user, req.body) }));
exports.list = asyncHandler(async (req, res) => res.json(await svc.list(req.user, req.query)));
exports.getOne = asyncHandler(async (req, res) => res.json({ data: await svc.getById(req.user, req.params.id) }));
exports.update = asyncHandler(async (req, res) => res.json({ data: await svc.update(req.user, req.params.id, req.body) }));
exports.escalate = asyncHandler(async (req, res) => res.json({ data: await svc.escalate(req.user, req.params.id) }));
exports.history = asyncHandler(async (req, res) => res.json({ data: await svc.getHistory(req.user, req.params.id) }));
exports.remove = asyncHandler(async (req, res) => {
  await svc.remove(req.user, req.params.id);
  res.status(204).end();
});
