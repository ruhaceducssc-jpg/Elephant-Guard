const mongoose = require('mongoose');

const guardNotificationSchema = new mongoose.Schema({
  guardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Guard',
    required: true,
    index: true,
  },
  residentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  detectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Detection',
    default: null,
  },
  alertId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Alert',
    default: null,
  },
  deliveryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NotificationDelivery',
    default: null,
  },
  type: {
    type: String,
    enum: [
      'resident_reply',
      'resident_help_request',
      'resident_protected',
      'resident_cannot_protect',
    ],
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  residentSnapshot: {
    name: String,
    phone: String,
    telegramChatId: String,
    village: String,
  },
  detectionSnapshot: {
    locationName: String,
    detectedAt: Date,
  },
  residentReply: {
    status: {
      type: String,
      enum: ['protected', 'help_requested', 'cannot_protect'],
      required: true,
    },
    label: String,
    repliedAt: Date,
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true,
  },
  readAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

guardNotificationSchema.index({
  guardId: 1,
  isRead: 1,
  createdAt: -1,
});

guardNotificationSchema.index({
  guardId: 1,
  deliveryId: 1,
  'residentReply.status': 1,
});

module.exports = mongoose.model('GuardNotification', guardNotificationSchema);
