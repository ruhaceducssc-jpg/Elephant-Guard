const express = require('express');
const router = express.Router();
const {
  getMe,
  updateMe,
  updateSecurity,
  updatePatrolArea,
  uploadAvatar,
  forgotPassword,
} = require('../controllers/guardController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.route('/me').get(protect, getMe).put(protect, updateMe);
router.put('/me/patrol-area', protect, updatePatrolArea);
router.put('/security', protect, updateSecurity);
router.post('/forgot-password', forgotPassword); // Public
router.post('/avatar', protect, upload.single('avatar'), uploadAvatar);

module.exports = router;
