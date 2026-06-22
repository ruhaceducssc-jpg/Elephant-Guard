const User = require('../models/User');
const {
  isValidLatitude,
  isValidLongitude,
} = require('../utils/alertUtils');

const parseResidentLocation = ({ longitude, latitude }) => {
  const parsedLongitude = Number(longitude);
  const parsedLatitude = Number(latitude);

  if (!isValidLongitude(parsedLongitude) || !isValidLatitude(parsedLatitude)) {
    const error = new Error('Resident latitude or longitude is invalid');
    error.statusCode = 400;
    throw error;
  }

  return [parsedLongitude, parsedLatitude];
};

const parseGeofenceRadius = (value, { required = false } = {}) => {
  if ((value === undefined || value === null || value === '') && !required) {
    return undefined;
  }

  const radiusMeters = Number(value);
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) {
    const error = new Error('Geofence radius must be a positive number of meters');
    error.statusCode = 400;
    throw error;
  }

  return radiusMeters;
};

// @desc    Register a new public user
// @route   POST /api/users
// @access  Private (Guard only)
exports.createUser = async (req, res) => {
  const { name, phone, telegramChatId, village, longitude, latitude, areaName, geofenceRadiusMeters, notificationEnabled } = req.body;

  if (!name || !phone || !village || longitude === undefined || latitude === undefined) {
    return res.status(400).json({ message: 'Please provide all required fields including coordinates' });
  }

  try {
    const coordinates = parseResidentLocation({ longitude, latitude });
    const radiusMeters = parseGeofenceRadius(geofenceRadiusMeters);

    // Check if user with phone already exists
    const userExists = await User.findOne({ phone });
    if (userExists) {
      return res.status(409).json({ 
        message: `A resident with phone number ${phone} is already registered.` 
      });
    }

    const user = await User.create({
      name,
      phone,
      telegramChatId: telegramChatId || '',
      village,
      areaLocation: {
        type: 'Point',
        coordinates,
        areaName
      },
      ...(radiusMeters !== undefined ? { geofenceRadiusMeters: radiusMeters } : {}),
      notificationEnabled: notificationEnabled !== undefined ? notificationEnabled : true,
      registeredBy: req.guard._id,
    });

    res.status(201).json(user);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ 
        message: 'A resident with this phone number is already registered.' 
      });
    }
    res.status(error.statusCode || 400).json({ message: error.message });
  }
};

// @desc    Get all users
// @route   GET /api/users
// @access  Private
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({ registeredBy: req.guard._id }).populate('registeredBy', 'name');
    res.json({
      success: true,
      residents: users
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, registeredBy: req.guard._id });

    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private
exports.updateUser = async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      registeredBy: req.guard._id,
    });

    if (user) {
      // Check if phone number is being changed and if new one already exists
      if (req.body.phone && req.body.phone !== user.phone) {
        const phoneExists = await User.findOne({ phone: req.body.phone });
        if (phoneExists) {
          return res.status(409).json({ 
            message: `A resident with phone number ${req.body.phone} is already registered.` 
          });
        }
        user.phone = req.body.phone;
      }

      user.name = req.body.name || user.name;
      user.telegramChatId = req.body.telegramChatId !== undefined
        ? req.body.telegramChatId
        : user.telegramChatId;
      user.village = req.body.village || user.village;
      
      const locationWasProvided = req.body.longitude !== undefined || req.body.latitude !== undefined;
      if (locationWasProvided) {
        if (req.body.longitude === undefined || req.body.latitude === undefined) {
          return res.status(400).json({
            message: 'Both resident latitude and longitude are required when updating location',
          });
        }
        user.areaLocation.coordinates = parseResidentLocation(req.body);
      }
      
      user.areaLocation.areaName = req.body.areaName || user.areaLocation.areaName;
      if (req.body.geofenceRadiusMeters !== undefined) {
        user.geofenceRadiusMeters = parseGeofenceRadius(
          req.body.geofenceRadiusMeters,
          { required: true }
        );
      }
      user.notificationEnabled = req.body.notificationEnabled !== undefined ? req.body.notificationEnabled : user.notificationEnabled;

      const updatedUser = await user.save();
      res.json(updatedUser);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(error.statusCode || 400).json({ message: error.message });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      registeredBy: req.guard._id,
    });

    if (user) {
      await user.deleteOne();
      res.json({ message: 'User removed' });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
