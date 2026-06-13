const mongoose = require('mongoose');

const pendingGuardSchema = new mongoose.Schema({
  verificationSessionId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  assignedArea: {
    type: String,
    required: true,
  },
  telegramChatId: {
    type: String,
    default: '',
  },
  patrolArea: {
    type: {
      type: String,
      enum: ['Polygon'],
      default: 'Polygon',
    },
    coordinates: {
      type: [[[Number]]],
    },
  },
  otpHash: {
    type: String,
    required: true,
  },
  otpExpiresAt: {
    type: Date,
    required: true,
  },
  otpAttempts: {
    type: Number,
    default: 0,
  },
  resendCount: {
    type: Number,
    default: 0,
  },
  resendAvailableAt: {
    type: Date,
    required: true,
  },
  registrationExpiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 },
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('PendingGuard', pendingGuardSchema);
