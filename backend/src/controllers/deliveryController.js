const Alert = require('../models/Alert');
const NotificationDelivery = require('../models/NotificationDelivery');
const User = require('../models/User');
const { calculateDistance } = require('../services/geocodingService');
const { sendAlert } = require('../services/telegramService');
const { normalizeAlert } = require('../utils/alertUtils');

// @desc    Get all alert events with delivery summaries
// @route   GET /api/deliveries
// @access  Private
exports.getDeliveries = async (req, res) => {
  try {
    const alerts = await Alert.find({ detectedBy: req.guard._id })
      .sort('-detectedAt')
      .limit(50);

    const events = await Promise.all(alerts.map(async (alert) => {
      const deliveries = await NotificationDelivery.find({ alertId: alert._id });
      
      return {
        alertId: alert._id,
        locationName: alert.location?.locationName || 'Unknown',
        detectedAt: alert.detectedAt,
        confidence: alert.confidence,
        summary: {
          total: deliveries.length,
          sent: deliveries.filter(d => d.status === 'sent').length,
          failed: deliveries.filter(d => d.status === 'failed').length,
          pending: deliveries.filter(d => d.status === 'pending' || d.status === 'retrying').length,
          notSent: deliveries.filter(d => d.status === 'not_sent').length,
        }
      };
    }));

    res.json({ success: true, events });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get delivery records and summary for one alert
// @route   GET /api/deliveries/:alertId
// @access  Private
exports.getDeliveryDetails = async (req, res) => {
  try {
    const alert = await Alert.findOne({ _id: req.params.alertId, detectedBy: req.guard._id });
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });

    const deliveries = await NotificationDelivery.find({ alertId: alert._id }).sort('residentName');

    const summary = {
      total: deliveries.length,
      sent: deliveries.filter(d => d.status === 'sent').length,
      failed: deliveries.filter(d => d.status === 'failed').length,
      pending: deliveries.filter(d => d.status === 'pending' || d.status === 'retrying').length,
      notSent: deliveries.filter(d => d.status === 'not_sent').length,
    };

    res.json({
      success: true,
      alert: normalizeAlert(alert),
      summary,
      deliveries
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Generate missing delivery records for an alert
// @route   POST /api/deliveries/:alertId/generate
// @access  Private
exports.generateMissingDeliveries = async (req, res) => {
  try {
    const alert = await Alert.findOne({ _id: req.params.alertId, detectedBy: req.guard._id });
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });

    const existingDeliveries = await NotificationDelivery.find({ alertId: alert._id });
    if (existingDeliveries.length > 0) {
      return res.status(400).json({ success: false, message: 'Delivery records already exist for this alert' });
    }

    // Geofence logic to find affected residents
    const allResidents = await User.find({ notificationEnabled: true });
    const normalizedAlert = normalizeAlert(alert);
    
    const affected = [];
    for (const resident of allResidents) {
      if (!resident.areaLocation?.coordinates) continue;
      const dist = calculateDistance(
        normalizedAlert.latitude, 
        normalizedAlert.longitude, 
        resident.areaLocation.coordinates[1], 
        resident.areaLocation.coordinates[0]
      );
      if (dist <= (resident.geofenceRadiusMeters || 1000)) {
        affected.push({ ...resident.toObject(), distance: dist });
      }
    }

    if (affected.length === 0) {
      await Alert.findByIdAndUpdate(alert._id, { notificationStatus: 'none' });
      return res.json({ success: true, message: 'No residents were affected by this alert', deliveries: [] });
    }

    const created = await Promise.all(affected.map(res => 
      NotificationDelivery.create({
        alertId: alert._id,
        residentId: res._id,
        residentName: res.name,
        phone: res.phone,
        telegramChatId: res.telegramChatId || 'NOT_SET',
        status: !res.telegramChatId ? 'not_sent' : 'pending',
        errorMessage: !res.telegramChatId ? 'Telegram Chat ID missing' : '',
        distanceFromElephant: res.distance
      })
    ));

    res.status(201).json({ success: true, message: `Generated ${created.length} delivery records`, deliveries: created });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Resend/Send notification for one delivery record
// @route   POST /api/deliveries/:alertId/resend/:deliveryId
// @access  Private
exports.resendSingle = async (req, res) => {
  try {
    const delivery = await NotificationDelivery.findOne({ _id: req.params.deliveryId, alertId: req.params.alertId });
    if (!delivery) return res.status(404).json({ success: false, message: 'Delivery record not found' });

    const alert = await Alert.findById(req.params.alertId);
    const resident = await User.findById(delivery.residentId);

    if (!resident || !resident.telegramChatId) {
      return res.status(400).json({ success: false, message: 'Resident has no Telegram Chat ID linked' });
    }

    // Update ID if it was NOT_SET
    if (delivery.telegramChatId === 'NOT_SET') {
      delivery.telegramChatId = resident.telegramChatId;
    }

    delivery.status = 'retrying';
    await delivery.save();

    const result = await sendAlert(resident.telegramChatId, {
      ...normalizeAlert(alert),
      distanceFromResident: delivery.distanceFromElephant,
      residentAreaName: resident.areaLocation?.areaName
    });

    delivery.retryCount += 1;
    delivery.lastRetryAt = new Date();

    if (result.success) {
      delivery.status = 'sent';
      delivery.sentAt = new Date();
      delivery.errorMessage = '';
    } else {
      delivery.status = 'failed';
      delivery.errorMessage = result.error || 'Retry failed';
    }

    await delivery.save();
    
    // Emit socket update if needed
    const io = req.app.get('socketio');
    if (io) io.emit('delivery-updated', delivery);

    res.json({ success: true, delivery });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Resend all failed/unsent for an alert
// @route   POST /api/deliveries/:alertId/resend-failed
// @access  Private
exports.resendAllFailed = async (req, res) => {
  try {
    const toRetry = await NotificationDelivery.find({ 
      alertId: req.params.alertId, 
      status: { $in: ['failed', 'not_sent'] } 
    });

    if (toRetry.length === 0) return res.json({ success: true, message: 'No failed records to retry' });

    const alert = await Alert.findById(req.params.alertId);
    const normalizedAlert = normalizeAlert(alert);
    const results = [];

    for (const delivery of toRetry) {
      const resident = await User.findById(delivery.residentId);
      if (!resident || !resident.telegramChatId) continue;

      if (delivery.telegramChatId === 'NOT_SET') {
        delivery.telegramChatId = resident.telegramChatId;
      }

      const resendResult = await sendAlert(resident.telegramChatId, {
        ...normalizedAlert,
        distanceFromResident: delivery.distanceFromElephant,
        residentAreaName: resident.areaLocation?.areaName
      });

      delivery.retryCount += 1;
      delivery.lastRetryAt = new Date();

      if (resendResult.success) {
        delivery.status = 'sent';
        delivery.sentAt = new Date();
        delivery.errorMessage = '';
      } else {
        delivery.status = 'failed';
        delivery.errorMessage = resendResult.error || 'Retry failed';
      }

      await delivery.save();
      results.push(delivery);
    }

    res.json({ success: true, processed: results.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
