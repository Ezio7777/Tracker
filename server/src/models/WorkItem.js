const { Schema, model } = require('mongoose');
const {
  ALL_STATUSES, TASK_STATUSES, TICKET_STATUSES, PRIORITIES, PRIORITY_RANK,
} = require('../constants/statuses');

const workItemSchema = new Schema(
  {
    type: { type: String, enum: ['TASK', 'TICKET'], required: true, immutable: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 5000 },
    status: { type: String, enum: ALL_STATUSES, required: true },
    priority: { type: String, enum: PRIORITIES, default: 'MEDIUM' },
    priorityRank: { type: Number, default: 2 }, // lets us sort by priority numerically
    project: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    requester: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    assignee: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    dueDate: { type: Date, default: null },
    dueSoonNotifiedAt: { type: Date, default: null },
    escalatedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

workItemSchema.pre('validate', function (next) {
  if (this.type === 'TASK' && !this.project) this.invalidate('project', 'A TASK requires a project');
  const valid = this.type === 'TASK' ? TASK_STATUSES : TICKET_STATUSES;
  if (this.status && !valid.includes(this.status)) {
    this.invalidate('status', `${this.status} is not a valid status for a ${this.type}`);
  }
  if (this.isNew || this.isModified('priority')) this.priorityRank = PRIORITY_RANK[this.priority];
  next();
});

workItemSchema.index({ project: 1, status: 1 });
workItemSchema.index({ assignee: 1, status: 1 });
workItemSchema.index({ requester: 1 });
workItemSchema.index({ type: 1, status: 1, priority: 1 });
workItemSchema.index({ deletedAt: 1, dueDate: 1 });
workItemSchema.index({ createdAt: -1 });

module.exports = model('WorkItem', workItemSchema);
