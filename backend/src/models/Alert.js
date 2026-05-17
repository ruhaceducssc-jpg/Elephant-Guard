const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  image: {
    type: String,
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
    locationName: String,
  },
  confidence: {
    type: Number,
    default: 0,
  },
  insidePatrolArea: {
    type: Boolean,
    default: false,
  },
  alertStatus: {
    type: String,
    enum: ['new', 'acknowledged', 'resolved', 'dismissed'],
    default: 'new',
  },
  notes: {
    type: String,
    default: '',
  },
  detectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Guard',
    required: true,
  },
  detectedAt: {
  type: Date,
  default: Date.now,
  },
  affectedResidentIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  notificationStatus: {
  type: String,
  enum: ['pending', 'sent', 'failed', 'partial'],
  default: 'pending',
  },
  recipientCount: {
  type: Number,
  default: 0,
  },
  sentAt: {
  type: Date,
  },
  }, {
  timestamps: true,
  });
// Index for map queries
alertSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Alert', alertSchema);
