const WorkItemHistory = require('../models/WorkItemHistory');

const record = ({ workItem, actor, action, from = null, to = null, meta = null }) =>
  WorkItemHistory.create({ workItem, actor, action, from, to, meta });

const forWorkItem = (workItemId) =>
  WorkItemHistory.find({ workItem: workItemId }).sort({ createdAt: 1 }).populate('actor', 'name role').lean();

module.exports = { record, forWorkItem };
