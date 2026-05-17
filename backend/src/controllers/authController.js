const Guard = require('../models/Guard');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Register a new guard
// @route   POST /api/auth/register
// @access  Public
exports.registerGuard = async (req, res) => {
  const { name, email, password, assignedArea, telegramChatId, patrolArea } = req.body;

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
      patrolArea: patrolArea || null,
    });

    if (guard) {
      res.status(201).json({
        _id: guard._id,
        name: guard.name,
        email: guard.email,
        assignedArea: guard.assignedArea,
        telegramChatId: guard.telegramChatId,
        avatar: guard.avatar,
        patrolArea: guard.patrolArea,
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
// @route   POST /api/auth/login
// @access  Public
exports.loginGuard = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide email and password' });
  }

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
        patrolArea: guard.patrolArea,
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
