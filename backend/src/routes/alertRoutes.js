const express = require('express');
const router = express.Router();
const {
  createAlert,
  getAlerts,
  getAlertById,
  deleteAlert,
  updateAlertStatus,
  updateAlertNotes,
  getAlertNotifications,
  getAllNotifications,
  resendNotification,
  resendAllFailedNotifications,
  testNotification,
} = require('../controllers/alertController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.route('/')
  .post(protect, upload.single('image'), createAlert)
  .get(protect, getAlerts);

router.get('/notifications', protect, getAllNotifications);
router.post('/notifications/test', protect, testNotification);
router.post('/:id/notifications/resend-failed', protect, resendAllFailedNotifications);
router.post('/:id/notifications/:deliveryId/resend', protect, resendNotification);
router.get('/:id/notifications', protect, getAlertNotifications);
router.patch('/:id/status', protect, updateAlertStatus);
router.patch('/:id/notes', protect, updateAlertNotes);

router.route('/:id')
  .get(getAlertById)
  .delete(protect, deleteAlert);

module.exports = router;
