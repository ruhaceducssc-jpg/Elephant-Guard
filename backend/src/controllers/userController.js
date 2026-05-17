const User = require('../models/User');

// @desc    Register a new public user
// @route   POST /api/users
// @access  Private (Guard only)
exports.createUser = async (req, res) => {
  const { name, phone, telegramChatId, village, longitude, latitude, areaName, geofenceRadiusMeters, notificationEnabled } = req.body;

  if (!name || !phone || !village || longitude === undefined || latitude === undefined) {
    return res.status(400).json({ message: 'Please provide all required fields including coordinates' });
  }

  try {
    const user = await User.create({
      name,
      phone,
      telegramChatId: telegramChatId || '',
      village,
      areaLocation: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
        areaName
      },
      geofenceRadiusMeters: parseFloat(geofenceRadiusMeters) || 1000,
      notificationEnabled: notificationEnabled !== undefined ? notificationEnabled : true,
      registeredBy: req.guard._id,
    });

    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get all users
// @route   GET /api/users
// @access  Private
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({ registeredBy: req.guard._id }).populate('registeredBy', 'name');
    res.json(users);
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
    const user = await User.findById(req.params.id);

    if (user) {
      user.name = req.body.name || user.name;
      user.phone = req.body.phone || user.phone;
      user.telegramChatId = req.body.telegramChatId || user.telegramChatId;
      user.village = req.body.village || user.village;
      
      if (req.body.longitude && req.body.latitude) {
        user.areaLocation.coordinates = [parseFloat(req.body.longitude), parseFloat(req.body.latitude)];
      }
      
      user.areaLocation.areaName = req.body.areaName || user.areaLocation.areaName;
      user.geofenceRadiusMeters = req.body.geofenceRadiusMeters !== undefined ? parseFloat(req.body.geofenceRadiusMeters) : user.geofenceRadiusMeters;
      user.notificationEnabled = req.body.notificationEnabled !== undefined ? req.body.notificationEnabled : user.notificationEnabled;

      const updatedUser = await user.save();
      res.json(updatedUser);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

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
