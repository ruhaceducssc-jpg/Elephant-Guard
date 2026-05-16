const express = require('express');
const router = express.Router();
const {
  getMe,
  updateMe,
  updatePassword,
  uploadAvatar,
  setSecurityKey,
  recoverPassword,
} = require('../controllers/guardController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.route('/me').get(protect, getMe).put(protect, updateMe);
router.put('/password', protect, updatePassword);
router.post('/security-key', protect, setSecurityKey);
router.post('/recover', recoverPassword); // Public
router.post('/avatar', protect, upload.single('avatar'), uploadAvatar);

module.exports = router;
