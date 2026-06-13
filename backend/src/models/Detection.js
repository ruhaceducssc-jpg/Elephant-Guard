const mongoose = require('mongoose');

const detectionSchema = new mongoose.Schema({
  guardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Guard',
    required: true,
  },
  detectionSessionId: {
    type: String,
    index: true,
  },
  source: {
    type: String,
    default: 'camera',
    enum: ['camera', 'upload', 'manual'],
  },
  imageUrl: {
    type: String,
  },
  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
  },
  detectedAt: {
    type: Date,
    default: Date.now,
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
      validate: {
        validator: function(v) {
          return v.length === 2 && 
                 v[0] >= -180 && v[0] <= 180 && 
                 v[1] >= -90 && v[1] <= 90;
        },
        message: 'Invalid coordinates'
      }
    },
  },
  locationName: {
    type: String,
  },
  insideGuardArea: {
    type: Boolean,
    default: false,
  },
  alertId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Alert',
  },
  status: {
    type: String,
    enum: ['active', 'cleared', 'archived'],
    default: 'active',
  },
  clearedAt: {
    type: Date,
    default: null,
  },
  clearedBy: {
    type: String,
    default: null,
  },
  clearedByGuardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Guard',
    default: null,
  },
  clearReason: {
    type: String,
    trim: true,
    maxlength: 500,
    default: null,
  },
  statusHistory: [
    {
      from: String,
      to: String,
      source: {
        type: String,
        enum: ['system', 'resident_response', 'guard_action'],
      },
      guardId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Guard',
      },
      residentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      deliveryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'NotificationDelivery',
      },
      reason: String,
      changedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
}, {
  timestamps: true,
});

// Recommended compound unique index for idempotency per guard session
detectionSchema.index(
  { guardId: 1, detectionSessionId: 1 },
  { unique: true, sparse: true }
);

// Index for map queries
detectionSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Detection', detectionSchema);
