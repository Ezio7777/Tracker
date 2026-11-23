const asyncHandler = require('../utils/asyncHandler');
const svc = require('../services/notificationService');

exports.list = asyncHandler(async (req, res) => res.json(await svc.list(req.user, req.query)));
exports.unreadCount = asyncHandler(async (req, res) => res.json({ data: { unreadCount: await svc.unreadCount(req.user) } }));
exports.markRead = asyncHandler(async (req, res) => res.json({ data: await svc.markRead(req.user, req.params.id) }));
exports.markAllRead = asyncHandler(async (req, res) => res.json({ data: await svc.markAllRead(req.user) }));
