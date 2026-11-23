const { Schema, model } = require('mongoose');

const ACTIONS = ['CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'PRIORITY_CHANGED', 'ESCALATED', 'COMMENTED', 'UPDATED', 'DELETED'];

const historySchema = new Schema(
  {
    workItem: { type: Schema.Types.ObjectId, ref: 'WorkItem', required: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, enum: ACTIONS, required: true },
    from: { type: Schema.Types.Mixed, default: null },
    to: { type: Schema.Types.Mixed, default: null },
    meta: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
historySchema.index({ workItem: 1, createdAt: 1 });

module.exports = model('WorkItemHistory', historySchema);
