const Guard = require('../models/Guard');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Register a new guard
// @route   POST /api/guards/register
// @access  Public
exports.registerGuard = async (req, res) => {
  const { name, email, password, assignedArea, telegramChatId } = req.body;

  if (!name || !email || !password || !assignedArea) {
    return res.status(400).json({ message: 'Please provide all required fields' });
  }

  try {
    const guardExists = await Guard.findOne({ email });

    if (guardExists) {
      return res.status(400).json({ message: 'Guard already exists with this email' });
    }

    const guard = await Guard.create({
      name,
      email,
      password,
      assignedArea,
      telegramChatId: telegramChatId || '',
    });

    if (guard) {
      res.status(201).json({
        _id: guard._id,
        name: guard.name,
        email: guard.email,
        assignedArea: guard.assignedArea,
        telegramChatId: guard.telegramChatId,
        token: generateToken(guard._id),
      });
    } else {
      res.status(400).json({ message: 'Invalid guard data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Authenticate a guard & get token
// @route   POST /api/guards/login
// @access  Public
exports.loginGuard = async (req, res) => {
  const { email, password } = req.body;

  try {
    const guard = await Guard.findOne({ email }).select('+password');

    if (guard && (await guard.matchPassword(password))) {
      // Update last login
      guard.lastLogin = new Date();
      await guard.save();

      res.json({
        _id: guard._id,
        name: guard.name,
        email: guard.email,
        assignedArea: guard.assignedArea,
        telegramChatId: guard.telegramChatId,
        role: guard.role,
        avatar: guard.avatar,
        accountStatus: guard.accountStatus,
        token: generateToken(guard._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current logged-in guard profile
// @route   GET /api/guards/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const guard = await Guard.findById(req.guard._id);

    if (guard) {
      res.json(guard);
    } else {
      res.status(404).json({ message: 'Guard not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update guard profile
// @route   PUT /api/guards/me
// @access  Private
exports.updateMe = async (req, res) => {
  try {
    const guard = await Guard.findById(req.guard._id);

    if (guard) {
      // General Information
      guard.name = req.body.name || guard.name;
      guard.email = req.body.email || guard.email;
      guard.phone = req.body.phone || guard.phone;
      guard.assignedArea = req.body.assignedArea || guard.assignedArea;
      guard.telegramChatId = req.body.telegramChatId !== undefined ? req.body.telegramChatId : guard.telegramChatId;
      guard.language = req.body.language || guard.language;
      guard.timezone = req.body.timezone || guard.timezone;
      guard.avatar = req.body.avatar || guard.avatar;

      // Nested Settings
      if (req.body.notificationPreferences) {
        guard.notificationPreferences = { ...guard.notificationPreferences, ...req.body.notificationPreferences };
      }
      
      if (req.body.quietHours) {
        guard.quietHours = { ...guard.quietHours, ...req.body.quietHours };
      }

      if (req.body.patrolSettings) {
        guard.patrolSettings = { ...guard.patrolSettings, ...req.body.patrolSettings };
      }

      if (req.body.emergencyContact) {
        guard.emergencyContact = { ...guard.emergencyContact, ...req.body.emergencyContact };
      }

      const updatedGuard = await guard.save();

      res.json(updatedGuard);
    } else {
      res.status(404).json({ message: 'Guard not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update guard password
// @route   PUT /api/guards/password
// @access  Private
exports.updatePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    const guard = await Guard.findById(req.guard._id).select('+password');

    if (!guard) {
      return res.status(404).json({ message: 'Guard not found' });
    }

    if (!(await guard.matchPassword(currentPassword))) {
      return res.status(401).json({ message: 'Current password incorrect' });
    }

    guard.password = newPassword;
    guard.lastPasswordChange = new Date();
    await guard.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Upload profile picture
// @route   POST /api/guards/avatar
// @access  Private
exports.uploadAvatar = async (req, res) => {
  try {
    const guard = await Guard.findById(req.guard._id);

    if (!guard) {
      return res.status(404).json({ message: 'Guard not found' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a file' });
    }

    guard.avatar = req.file.filename;
    await guard.save();

    res.json({
      message: 'Avatar uploaded successfully',
      avatar: guard.avatar,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
