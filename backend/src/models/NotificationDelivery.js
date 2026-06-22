const mongoose = require('mongoose');

const notificationDeliverySchema = new mongoose.Schema({
  alertId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Alert',
    required: true,
  },
  detectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Detection',
    required: true,
  },
  guardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Guard',
    required: true,
  },
  residentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  notificationStatus: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'not_sent', 'retrying'],
    default: 'pending',
  },
  residentResponse: {
    status: {
      type: String,
      enum: ['pending', 'protected', 'cannot_protect', 'help_requested'],
      default: 'pending',
    },
    respondedAt: Date,
    telegramUserId: String,
    telegramChatId: String,
  },
  guardAssessment: {
    status: {
      type: String,
      enum: ['pending', 'protected', 'attacked', 'help_requested'],
      default: 'pending',
    },
    guardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Guard',
    },
    updatedAt: Date,
    note: {
      type: String,
      default: '',
    },
  },
  telegramChatId: {
    type: String,
    default: '',
  },
  telegramMessageId: {
    type: String,
  },
  distanceToDetectionMeters: {
    type: Number,
    default: null,
  },
  residentSnapshot: {
    name: String,
    phone: String,
    telegramChatId: String,
    village: String,
    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: [Number],
    },
    geofenceRadiusMeters: Number,
  },
  residentGeofenceRadiusMeters: {
    type: Number,
  },
  insideGuardArea: {
    type: Boolean,
    default: false,
  },
  insideGuardBoundary: {
    type: Boolean,
    default: false,
  },
  insideResidentGeofence: {
    type: Boolean,
    default: false,
  },
  eligibilityStatus: {
    type: String,
    default: '',
  },
  automaticAttemptedAt: {
    type: Date,
    default: null,
  },
  sentAt: {
    type: Date,
  },
  failedAt: {
    type: Date,
  },
  errorMessage: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

notificationDeliverySchema.index({ alertId: 1, residentId: 1 }, { unique: true });
notificationDeliverySchema.index({ detectionId: 1, residentId: 1 }, { unique: true });
notificationDeliverySchema.index({ residentId: 1 });

module.exports = mongoose.model('NotificationDelivery', notificationDeliverySchema);
