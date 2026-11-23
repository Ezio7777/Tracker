const { Schema, model } = require('mongoose');

const NOTIFICATION_TYPES = ['ASSIGNED', 'STATUS_CHANGED', 'COMMENTED', 'TICKET_CREATED', 'DUE_SOON', 'ESCALATED'];

const notificationSchema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    message: { type: String, required: true },
    entityType: { type: String, default: 'WORK_ITEM' },
    entityId: { type: Schema.Types.ObjectId, required: true },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }); // keep 90 days

module.exports = model('Notification', notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
