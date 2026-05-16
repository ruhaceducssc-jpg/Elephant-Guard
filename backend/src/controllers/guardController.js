const Guard = require('../models/Guard');
const bcrypt = require('bcryptjs');

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

// @desc    Set or update security key
// @route   POST /api/guards/security-key
// @access  Private
exports.setSecurityKey = async (req, res) => {
  const { securityKey, password } = req.body;

  try {
    const guard = await Guard.findById(req.guard._id).select('+password');

    if (!(await guard.matchPassword(password))) {
      return res.status(401).json({ message: 'Password incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    guard.securityKeyHash = await bcrypt.hash(securityKey, salt);
    guard.securityKeyUpdatedAt = new Date();
    await guard.save();

    res.json({ message: 'Security key updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Recover password using security key
// @route   POST /api/guards/recover
// @access  Public (but requires email and security key)
exports.recoverPassword = async (req, res) => {
  const { email, securityKey, newPassword } = req.body;

  try {
    const guard = await Guard.findOne({ email }).select('+securityKeyHash');

    if (!guard) {
      return res.status(404).json({ message: 'Guard not found' });
    }

    if (!guard.securityKeyHash) {
      return res.status(400).json({ message: 'No recovery key set for this account' });
    }

    const isMatch = await bcrypt.compare(securityKey, guard.securityKeyHash);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid security key' });
    }

    guard.password = newPassword;
    guard.lastPasswordChange = new Date();
    await guard.save();

    res.json({ message: 'Password recovered successfully. You can now login.' });
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
