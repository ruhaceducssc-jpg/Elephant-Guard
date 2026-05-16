const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const guardSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email',
    ],
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false,
  },
  assignedArea: {
    type: String,
    required: [true, 'Please add an assigned area'],
  },
  phone: {
    type: String,
    default: '',
  },
  role: {
    type: String,
    default: 'Wildlife Guard',
  },
  telegramChatId: {
    type: String,
    default: '',
  },
  notificationPreferences: {
    telegramEnabled: { type: Boolean, default: true },
    emailEnabled: { type: Boolean, default: true },
    browserEnabled: { type: Boolean, default: true },
    soundEnabled: { type: Boolean, default: true },
    vibrationEnabled: { type: Boolean, default: true },
  },
  quietHours: {
    enabled: { type: Boolean, default: false },
    start: { type: String, default: '22:00' },
    end: { type: String, default: '06:00' },
  },
  patrolSettings: {
    defaultGeofenceRadius: { type: Number, default: 1000 },
    mapZoom: { type: Number, default: 13 },
    focusArea: { type: String, default: '' },
  },
  emergencyContact: {
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    stationName: { type: String, default: '' },
  },
  language: {
    type: String,
    default: 'English',
  },
  timezone: {
    type: String,
    default: 'Asia/Colombo',
  },
  avatar: {
    type: String,
    default: '',
  },
  accountStatus: {
    type: String,
    enum: ['active', 'suspended', 'on-leave'],
    default: 'active',
  },
  lastLogin: {
    type: Date,
  },
  lastPasswordChange: {
    type: Date,
    default: Date.now,
  },
  securityKeyHash: {
    type: String,
    select: false,
  },
  securityKeyUpdatedAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Encrypt password using bcrypt
guardSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match guard entered password to hashed password in database
guardSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Guard', guardSchema);
