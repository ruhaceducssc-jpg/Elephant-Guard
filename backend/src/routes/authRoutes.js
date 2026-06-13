const express = require('express');
const router = express.Router();
const { 
  registerGuard, 
  loginGuard, 
  verifyOtp, 
  resendOtp 
} = require('../controllers/authController');

router.post('/register', registerGuard);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/login', loginGuard);

module.exports = router;
