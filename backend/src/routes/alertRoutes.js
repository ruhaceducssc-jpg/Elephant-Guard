const express = require('express');
const router = express.Router();
const {
  createAlert,
  getAlerts,
  getAlertById,
  deleteAlert,
  clearAlert,
  updateAlertStatus,
  getDetectionResidents,
  resendNotification,
  testNotification,
} = require('../controllers/alertController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.route('/')
  .post(protect, upload.single('image'), createAlert)
  .get(protect, getAlerts);

router.post('/notifications/test', protect, testNotification);
router.post('/notifications/:deliveryId/resend', protect, resendNotification);

// Detection Specifics
router.get('/:id/residents', protect, getDetectionResidents);
router.patch('/:id/clear', protect, clearAlert);
router.patch('/:id/status', protect, updateAlertStatus);

router.route('/:id')
  .get(protect, getAlertById)
  .delete(protect, deleteAlert);

module.exports = router;
