const Guard = require('../models/Guard');
const PendingGuard = require('../models/PendingGuard');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendGuardRegistrationOtp } = require('../services/emailService');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// Helper to hash OTP
const hashOtp = (sessionId, otp) => {
  return crypto
    .createHmac('sha256', process.env.OTP_HASH_SECRET || 'lanka_beacon_otp_secret_key_2026')
    .update(`${sessionId}:${otp}`)
    .digest('hex');
};

// @desc    Initiate guard registration & send OTP
// @route   POST /api/auth/register
// @access  Public
exports.registerGuard = async (req, res) => {
  const { name, email, password, assignedArea, telegramChatId, patrolArea } = req.body;

  if (!name || !email || !password || !assignedArea) {
    return res.status(400).json({ message: 'Please provide all required fields' });
  }

  try {
    // 1. Check if guard already exists
    const guardExists = await Guard.findOne({ email });
    if (guardExists) {
      return res.status(409).json({ message: 'An account already exists with this email' });
    }

    // 2. Validate Patrol Area
    let validPatrolArea = null;
    if (patrolArea) {
      if (patrolArea.type !== 'Polygon' || !patrolArea.coordinates || !patrolArea.coordinates[0]) {
        return res.status(400).json({ message: 'Invalid patrol area format' });
      }
      const coords = patrolArea.coordinates[0];
      if (coords.length < 4) {
        return res.status(400).json({ message: 'Patrol area must have at least 3 points' });
      }
      validPatrolArea = patrolArea;
    }

    // 3. Prepare Registration Data
    const passwordHash = await bcrypt.hash(password, 10);
    const verificationSessionId = crypto.randomUUID();
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = hashOtp(verificationSessionId, otp);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const resendAvailableAt = new Date(Date.now() + 60 * 1000); // 60 seconds
    const registrationExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // 4. Save Pending Registration (Upsert based on email)
    await PendingGuard.findOneAndDelete({ email });
    await PendingGuard.create({
      verificationSessionId,
      name,
      email,
      passwordHash,
      assignedArea,
      telegramChatId: telegramChatId || '',
      patrolArea: validPatrolArea,
      otpHash,
      otpExpiresAt,
      resendAvailableAt,
      registrationExpiresAt
    });

    // 5. Send OTP Email
    try {
      await sendGuardRegistrationOtp({
        recipientEmail: email,
        recipientName: name,
        otp,
        expiresInMinutes: 10
      });
    } catch (emailError) {
      console.error('Email send failure:', emailError);
      return res.status(502).json({ message: 'We could not send the verification email. Please try again.' });
    }

    // 6. Return Session Info
    const maskedEmail = email.replace(/^(..)(.*)(@.*)$/, (_, a, b, c) => a + b.replace(/./g, '*') + c);
    
    res.status(200).json({
      success: true,
      requiresEmailVerification: true,
      verificationSessionId,
      maskedEmail,
      expiresInSeconds: 600,
      resendAvailableInSeconds: 60,
      message: 'A verification code was sent to your email.'
    });
  } catch (error) {
    console.error('Registration initiation error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify OTP and create permanent Guard account
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOtp = async (req, res) => {
  const { verificationSessionId, otp } = req.body;

  if (!verificationSessionId || !otp) {
    return res.status(400).json({ message: 'Verification session and OTP are required' });
  }

  try {
    const pending = await PendingGuard.findOne({ verificationSessionId });

    if (!pending) {
      return res.status(404).json({ message: 'Registration session expired or not found' });
    }

    // Check expiry
    if (new Date() > pending.otpExpiresAt) {
      return res.status(400).json({ message: 'Verification code has expired' });
    }

    // Check attempts
    if (pending.otpAttempts >= 5) {
      return res.status(400).json({ message: 'Maximum verification attempts exceeded. Please resend code.' });
    }

    // Verify OTP
    const submittedOtpHash = hashOtp(verificationSessionId, otp);
    if (submittedOtpHash !== pending.otpHash) {
      pending.otpAttempts += 1;
      await pending.save();
      return res.status(400).json({ 
        message: 'Invalid verification code', 
        remainingAttempts: 5 - pending.otpAttempts 
      });
    }

    // OTP Valid - Create Guard Account
    const guard = await Guard.create({
      name: pending.name,
      email: pending.email,
      password: pending.passwordHash,
      assignedArea: pending.assignedArea,
      telegramChatId: pending.telegramChatId,
      patrolArea: pending.patrolArea,
      patrolAreaPointCount: pending.patrolArea?.coordinates[0].length || 0,
      patrolAreaUpdatedAt: pending.patrolArea ? new Date() : undefined
    });

    // Cleanup
    await PendingGuard.deleteOne({ _id: pending._id });

    res.status(201).json({
      success: true,
      message: 'Email verified successfully. Your guard account is ready.',
      token: generateToken(guard._id)
    });

  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Resend registration OTP
// @route   POST /api/auth/resend-otp
// @access  Public
exports.resendOtp = async (req, res) => {
  const { verificationSessionId } = req.body;

  if (!verificationSessionId) {
    return res.status(400).json({ message: 'Verification session ID is required' });
  }

  try {
    const pending = await PendingGuard.findOne({ verificationSessionId });

    if (!pending) {
      return res.status(404).json({ message: 'Registration session expired or not found' });
    }

    // Check cooldown
    if (new Date() < pending.resendAvailableAt) {
      const remaining = Math.ceil((pending.resendAvailableAt - new Date()) / 1000);
      return res.status(429).json({ message: `Please wait ${remaining} seconds before resending` });
    }

    // Check resend limit
    if (pending.resendCount >= 3) {
      return res.status(400).json({ message: 'Maximum resend limit reached' });
    }

    // Generate new OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    pending.otpHash = hashOtp(verificationSessionId, otp);
    pending.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    pending.resendAvailableAt = new Date(Date.now() + 60 * 1000);
    pending.resendCount += 1;
    pending.otpAttempts = 0; // Reset attempts for new OTP
    await pending.save();

    // Send Email
    try {
      await sendGuardRegistrationOtp({
        recipientEmail: pending.email,
        recipientName: pending.name,
        otp,
        expiresInMinutes: 10
      });
    } catch (emailError) {
      return res.status(502).json({ message: 'Failed to send email. Please try again.' });
    }

    res.json({
      success: true,
      message: 'A new verification code was sent to your email.',
      resendAvailableInSeconds: 60
    });

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
