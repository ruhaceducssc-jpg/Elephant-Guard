const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  detectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Detection',
    required: true,
    unique: true,
  },
  guardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Guard',
    required: true,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
  },
  detectedAt: {
    type: Date,
    required: true,
  },
  generatedAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['active', 'cleared', 'closed'],
    default: 'active',
  },
  linkedResidentCount: {
    type: Number,
    default: 0,
  },
  eligibleResidentCount: {
    type: Number,
    default: 0,
  },
  notificationSummary: {
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
    not_sent: { type: Number, default: 0 },
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Alert', alertSchema);
