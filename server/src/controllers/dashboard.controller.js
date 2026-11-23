const asyncHandler = require('../utils/asyncHandler');
const dashboardService = require('../services/dashboardService');

exports.summary = asyncHandler(async (req, res) => res.json({ data: await dashboardService.summary(req.user) }));
