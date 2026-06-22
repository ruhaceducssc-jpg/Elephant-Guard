const Guard = require('../models/Guard');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const {
  PatrolAreaValidationError,
  normalizePatrolArea,
} = require('../utils/alertUtils');

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

  // Normalize email
  const normalizedEmail = String(email).trim().toLowerCase();

  // Validate email format
  if (!validator.isEmail(normalizedEmail)) {
    return res.status(400).json({ 
      success: false,
      code: 'INVALID_EMAIL',
      message: 'Enter a valid email address.' 
    });
  }

  try {
    // 1. Check if guard already exists
    const guardExists = await Guard.findOne({ email: normalizedEmail });
    if (guardExists) {
      return res.status(409).json({ 
        success: false,
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'An account already exists with this email.' 
      });
    }

    // 2. Validate Patrol Area
    let validPatrolArea = null;
    let pointCount = 0;
    if (patrolArea) {
      try {
        validPatrolArea = normalizePatrolArea(patrolArea);
        pointCount = validPatrolArea.coordinates[0].length;
      } catch (error) {
        if (error instanceof PatrolAreaValidationError) {
          return res.status(400).json({
            success: false,
            code: 'INVALID_PATROL_AREA',
            message: error.message,
          });
        }
        throw error;
      }
    }

    // 3. Create Guard Account
    const guard = await Guard.create({
      name,
      email: normalizedEmail,
      password, // Will be hashed by pre-save hook in Guard model
      assignedArea,
      telegramChatId: telegramChatId || '',
      patrolArea: validPatrolArea,
      patrolAreaPointCount: pointCount,
      patrolAreaUpdatedAt: patrolArea ? new Date() : undefined
    });

    if (guard) {
      res.status(201).json({
        success: true,
        message: 'Guard account created successfully. You can now log in.',
        guard: {
          _id: guard._id,
          name: guard.name,
          email: guard.email,
          assignedArea: guard.assignedArea,
          telegramChatId: guard.telegramChatId,
          avatar: guard.avatar,
          patrolArea: guard.patrolArea,
        }
      });
    } else {
      res.status(400).json({ message: 'Invalid guard data' });
    }
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ 
        success: false,
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'An account already exists with this email.' 
      });
    }
    console.error('Registration error:', error);
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

  // Normalize email for lookup
  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    const guard = await Guard.findOne({ email: normalizedEmail }).select('+password');

    if (!guard) {
      console.log(`Login attempt failed: Guard not found for email ${normalizedEmail}`);
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await guard.matchPassword(password);
    
    if (isMatch) {
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
      console.log(`Login attempt failed: Password mismatch for email ${normalizedEmail}`);
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: error.message });
  }
};
