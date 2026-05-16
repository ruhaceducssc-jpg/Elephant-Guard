const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
  },
  phone: {
    type: String,
    required: [true, 'Please add a phone number'],
    unique: true,
  },
  telegramChatId: {
    type: String,
    default: '',
  },
  village: {
    type: String,
    required: [true, 'Please add a village name'],
  },
  areaLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
    areaName: String
  },
  geofenceRadiusMeters: {
    type: Number,
    default: 1000, // Default 1km
  },
  notificationEnabled: {
    type: Boolean,
    default: true,
  },
  registeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Guard',
    required: true,
  },
}, {
  timestamps: true,
});

// Index for geo-spatial queries
userSchema.index({ areaLocation: '2dsphere' });

module.exports = mongoose.model('User', userSchema);
