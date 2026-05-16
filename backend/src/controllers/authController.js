const Guard = require('../models/Guard');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Register a new guard
// @route   POST /api/auth/register
// @access  Public (Should be protected in real app, but for demo it's open)
exports.registerGuard = async (req, res) => {
  const { name, email, password, assignedArea } = req.body;

  try {
    const guardExists = await Guard.findOne({ email });

    if (guardExists) {
      return res.status(400).json({ message: 'Guard already exists' });
    }

    const guard = await Guard.create({
      name,
      email,
      password,
      assignedArea,
    });

    if (guard) {
      res.status(201).json({
        _id: guard._id,
        name: guard.name,
        email: guard.email,
        assignedArea: guard.assignedArea,
        token: generateToken(guard._id),
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Auth guard & get token
// @route   POST /api/auth/login
// @access  Public
exports.loginGuard = async (req, res) => {
  const { email, password } = req.body;

  try {
    const guard = await Guard.findOne({ email }).select('+password');

    if (guard && (await guard.matchPassword(password))) {
      res.json({
        _id: guard._id,
        name: guard.name,
        email: guard.email,
        assignedArea: guard.assignedArea,
        token: generateToken(guard._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
