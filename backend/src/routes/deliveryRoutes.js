const express = require('express');
const router = express.Router();
const {
  getDeliveries,
  getDeliveryDetails,
  updateSafetyStatus,
  updateDeliveryNote,
  acknowledgeHelp,
  resendSingle
} = require('../controllers/deliveryController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', getDeliveries);
router.get('/:alertId', getDeliveryDetails);
router.patch('/:deliveryId/safety-status', updateSafetyStatus);
router.patch('/:deliveryId/note', updateDeliveryNote);
router.patch('/:deliveryId/acknowledge-help', acknowledgeHelp);
router.post('/:alertId/resend/:deliveryId', resendSingle);

module.exports = router;
