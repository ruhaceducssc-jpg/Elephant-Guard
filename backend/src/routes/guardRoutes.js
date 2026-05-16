const express = require('express');
const router = express.Router();
const {
  registerGuard,
  loginGuard,
  getMe,
  updateMe,
  updatePassword,
  uploadAvatar,
} = require('../controllers/guardController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/register', registerGuard);
router.post('/login', loginGuard);
router.route('/me').get(protect, getMe).put(protect, updateMe);
router.put('/password', protect, updatePassword);
router.post('/avatar', protect, upload.single('avatar'), uploadAvatar);

module.exports = router;
