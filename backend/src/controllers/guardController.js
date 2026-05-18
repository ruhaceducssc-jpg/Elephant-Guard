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
      guard.patrolArea = req.body.patrolArea !== undefined ? req.body.patrolArea : guard.patrolArea;
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

// @desc    Update guard security (password and/or recovery key)
// @route   PUT /api/guards/security
// @access  Private
exports.updateSecurity = async (req, res) => {
  const { currentPassword, newPassword, recoveryKey } = req.body;

  if (!currentPassword) {
    return res.status(400).json({ message: 'Current password is required for security updates' });
  }

  try {
    const guard = await Guard.findById(req.guard._id).select('+password');

    if (!guard) {
      return res.status(404).json({ message: 'Guard not found' });
    }

    // Verify current password
    const isMatch = await guard.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid current password' });
    }

    let updated = false;

    // Update password if provided
    if (newPassword) {
      guard.password = newPassword;
      guard.lastPasswordChange = new Date();
      updated = true;
    }

    // Update recovery key if provided
    if (recoveryKey) {
      const salt = await bcrypt.genSalt(10);
      guard.securityKeyHash = await bcrypt.hash(recoveryKey, salt);
      guard.securityKeyUpdatedAt = new Date();
      updated = true;
    }

    if (updated) {
      await guard.save();
      res.json({ success: true, message: 'Security settings updated successfully' });
    } else {
      res.status(400).json({ message: 'No changes provided' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Recover password using security key (Forgot Password)
// @route   POST /api/guards/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  const { email, recoveryKey, newPassword } = req.body;

  if (!email || !recoveryKey || !newPassword) {
    return res.status(400).json({ message: 'Please provide all required fields' });
  }

  try {
    const guard = await Guard.findOne({ email }).select('+securityKeyHash');

    if (!guard) {
      return res.status(404).json({ message: 'No account found with this email' });
    }

    if (!guard.securityKeyHash) {
      return res.status(400).json({ message: 'Recovery key is not configured for this account' });
    }

    const isMatch = await bcrypt.compare(recoveryKey, guard.securityKeyHash);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid recovery key' });
    }

    guard.password = newPassword;
    guard.lastPasswordChange = new Date();
    await guard.save();

    res.json({ success: true, message: 'Password reset successful. Please login with your new password.' });
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
