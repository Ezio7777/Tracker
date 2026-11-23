const { Schema, model } = require('mongoose');

const commentSchema = new Schema(
  {
    workItem: { type: Schema.Types.ObjectId, ref: 'WorkItem', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);
commentSchema.index({ workItem: 1, createdAt: 1 });

module.exports = model('Comment', commentSchema);
