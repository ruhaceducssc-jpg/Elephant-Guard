const express = require('express');
const router = express.Router();
const {
  getDeliveries,
  getDeliveryDetails,
  generateMissingDeliveries,
  resendSingle,
  resendAllFailed
} = require('../controllers/deliveryController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', getDeliveries);
router.get('/:alertId', getDeliveryDetails);
router.post('/:alertId/generate', generateMissingDeliveries);
router.post('/:alertId/resend-failed', resendAllFailed);
router.post('/:alertId/resend/:deliveryId', resendSingle);

module.exports = router;
