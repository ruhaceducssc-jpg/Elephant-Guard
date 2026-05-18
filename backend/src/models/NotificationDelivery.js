const mongoose = require('mongoose');

const notificationDeliverySchema = new mongoose.Schema({
  alertId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Alert',
    required: true,
  },
  residentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  residentName: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
  },
  telegramChatId: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'not_sent', 'retrying'],
    default: 'pending',
  },
  sentAt: {
    type: Date,
  },
  errorMessage: {
    type: String,
    default: '',
  },
  retryCount: {
    type: Number,
    default: 0,
  },
  lastRetryAt: {
    type: Date,
  },
  distanceFromElephant: {
    type: Number, // in meters
    required: true,
  },
}, {
  timestamps: true,
});

// Index for quick lookups
notificationDeliverySchema.index({ alertId: 1 });
notificationDeliverySchema.index({ residentId: 1 });

module.exports = mongoose.model('NotificationDelivery', notificationDeliverySchema);
