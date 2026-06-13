const Detection = require('../models/Detection');
const Alert = require('../models/Alert');
const NotificationDelivery = require('../models/NotificationDelivery');
const User = require('../models/User');
const { calculateDistance } = require('../services/geocodingService');
const { sendAlert } = require('../services/telegramService');
const { normalizeAlert } = require('../utils/alertUtils');
const { evaluateAndClearDetection, reopenDetection } = require('../services/detectionStatusService');

const getEffectiveSafetyStatus = (delivery) => {
  if (delivery.guardAssessment?.status && delivery.guardAssessment.status !== 'pending') {
    return delivery.guardAssessment.status;
  }
  return delivery.residentResponse?.status || 'pending';
};

// Helper to get safety summary for an alert
const getSafetySummary = async (alertId) => {
  const deliveries = await NotificationDelivery.find({ alertId });
  return {
    protected: deliveries.filter(d => getEffectiveSafetyStatus(d) === 'protected').length,
    pending: deliveries.filter(d => getEffectiveSafetyStatus(d) === 'pending').length,
    attackedOrCannotProtect: deliveries.filter(d => {
      const status = getEffectiveSafetyStatus(d);
      return status === 'attacked' || status === 'cannot_protect';
    }).length,
    requiredHelp: deliveries.filter(d => getEffectiveSafetyStatus(d) === 'help_requested').length
  };
};

// @desc    Get all detections with delivery summaries
// @route   GET /api/deliveries
// @access  Private
exports.getDeliveries = async (req, res) => {
  try {
    const detections = await Detection.find({ guardId: req.guard._id })
      .sort('-detectedAt')
      .limit(50);

    const events = await Promise.all(detections.map(async (det) => {
      const alert = await Alert.findOne({ detectionId: det._id });
      const deliveries = await NotificationDelivery.find({ detectionId: det._id });
      
      return {
        detectionId: det._id,
        alertId: alert ? alert._id : null,
        locationName: det.locationName || 'Unknown',
        detectedAt: det.detectedAt,
        confidence: det.confidence,
        status: det.status,
        summary: {
          total: deliveries.length,
          sent: deliveries.filter(d => d.notificationStatus === 'sent').length,
          failed: deliveries.filter(d => d.notificationStatus === 'failed').length,
          pending: deliveries.filter(d => d.notificationStatus === 'pending' || d.notificationStatus === 'retrying').length,
          notSent: deliveries.filter(d => d.notificationStatus === 'not_sent').length,
          helpRequests: deliveries.filter(d => getEffectiveSafetyStatus(d) === 'help_requested').length
        }
      };
    }));

    res.json({ success: true, events });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get delivery records and summary for one detection/alert
// @route   GET /api/deliveries/:alertId
// @access  Private
exports.getDeliveryDetails = async (req, res) => {
  try {
    const alert = await Alert.findOne({ _id: req.params.alertId, guardId: req.guard._id });
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });

    const deliveries = await NotificationDelivery.find({ alertId: alert._id })
      .populate('residentId', 'name phone village telegramChatId areaLocation')
      .sort('residentName');

    const summary = {
      total: deliveries.length,
      sent: deliveries.filter(d => d.notificationStatus === 'sent').length,
      failed: deliveries.filter(d => d.notificationStatus === 'failed').length,
      pending: deliveries.filter(d => d.notificationStatus === 'pending' || d.notificationStatus === 'retrying').length,
      notSent: deliveries.filter(d => d.notificationStatus === 'not_sent').length,
      protected: deliveries.filter(d => getEffectiveSafetyStatus(d) === 'protected').length,
      helpRequests: deliveries.filter(d => getEffectiveSafetyStatus(d) === 'help_requested').length,
      attackedOrCannotProtect: deliveries.filter(d => {
        const status = getEffectiveSafetyStatus(d);
        return status === 'attacked' || status === 'cannot_protect';
      }).length
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

// @desc    Update guard assessment for a delivery
// @route   PATCH /api/deliveries/:deliveryId/safety-status
// @access  Private
exports.updateSafetyStatus = async (req, res) => {
  const { safetyStatus, note } = req.body;
  try {
    const delivery = await NotificationDelivery.findOne({ 
      _id: req.params.deliveryId, 
      guardId: req.guard._id 
    }).populate('residentId', 'name phone village telegramChatId areaLocation');

    if (!delivery) return res.status(404).json({ success: false, message: 'Delivery record not found' });

    delivery.guardAssessment = {
      status: safetyStatus,
      guardId: req.guard._id,
      updatedAt: new Date(),
      note: note || ''
    };

    await delivery.save();
    
    const safetyOutcome = await getSafetySummary(delivery.alertId);
    
    // Evaluate automatic status changes
    let clearResult = null;
    let reopenResult = null;

    const detection = await Detection.findById(delivery.detectionId);
    if (detection) {
      if (detection.status === 'cleared' && safetyStatus !== 'protected') {
        reopenResult = await reopenDetection(detection._id, `Guard marked resident as ${safetyStatus.replace(/_/g, ' ')}.`, {
          source: 'guard_action',
          guardId: req.guard._id,
          deliveryId: delivery._id,
          residentId: delivery.residentId._id
        });
      } else if (detection.status === 'active' && safetyStatus === 'protected') {
        clearResult = await evaluateAndClearDetection(delivery.detectionId);
      }
    }
    
    const io = req.app.get('socketio');
    if (io) {
      io.emit('delivery-updated', delivery);
      io.emit('resident-safety-response', {
        deliveryId: delivery._id,
        detectionId: delivery.detectionId,
        alertId: delivery.alertId,
        residentId: delivery.residentId._id,
        residentResponse: delivery.residentResponse,
        guardAssessment: delivery.guardAssessment,
        effectiveSafetyStatus: getEffectiveSafetyStatus(delivery),
        safetyOutcome
      });

      if (clearResult && clearResult.cleared) {
        io.to(req.guard._id.toString()).emit('detection-status-updated', {
          detectionId: clearResult.detection._id,
          alertId: delivery.alertId,
          status: 'cleared',
          clearedAt: clearResult.detection.clearedAt,
          clearedBy: clearResult.detection.clearedBy,
          clearReason: clearResult.detection.clearReason
        });
      }

      if (reopenResult) {
        io.to(req.guard._id.toString()).emit('detection-status-updated', {
          detectionId: reopenResult._id,
          alertId: delivery.alertId,
          status: 'active',
          reopenedAt: new Date(),
          reason: reopenResult.statusHistory[reopenResult.statusHistory.length-1].reason
        });
      }
    }

    res.json({ success: true, delivery, safetyOutcome });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update delivery note
// @route   PATCH /api/deliveries/:deliveryId/note
// @access  Private
exports.updateDeliveryNote = async (req, res) => {
  const { guardNote } = req.body;
  try {
    const delivery = await NotificationDelivery.findOne({ 
      _id: req.params.deliveryId, 
      guardId: req.guard._id 
    });

    if (!delivery) return res.status(404).json({ success: false, message: 'Delivery record not found' });

    delivery.guardNote = guardNote;
    await delivery.save();
    
    res.json({ success: true, delivery });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Acknowledge help request
// @route   PATCH /api/deliveries/:deliveryId/acknowledge-help
// @access  Private
exports.acknowledgeHelp = async (req, res) => {
  try {
    const delivery = await NotificationDelivery.findOne({ 
      _id: req.params.deliveryId, 
      guardId: req.guard._id 
    }).populate('residentId', 'name phone village telegramChatId areaLocation');

    if (!delivery) return res.status(404).json({ success: false, message: 'Delivery record not found' });

    delivery.guardAssessment = {
      status: 'help_requested', // It's already help_requested, but we update the updatedAt and guardId
      guardId: req.guard._id,
      updatedAt: new Date(),
      note: 'Help request acknowledged by guard'
    };

    await delivery.save();
    
    const safetyOutcome = await getSafetySummary(delivery.alertId);

    // Reopen if cleared
    let reopenResult = null;
    const detection = await Detection.findById(delivery.detectionId);
    if (detection && detection.status === 'cleared') {
      reopenResult = await reopenDetection(detection._id, `Guard acknowledged help request for resident.`, {
        source: 'guard_action',
        guardId: req.guard._id,
        deliveryId: delivery._id,
        residentId: delivery.residentId._id
      });
    }
    
    const io = req.app.get('socketio');
    if (io) {
      io.emit('delivery-updated', delivery);
      io.emit('resident-safety-response', {
        deliveryId: delivery._id,
        detectionId: delivery.detectionId,
        alertId: delivery.alertId,
        residentId: delivery.residentId._id,
        residentResponse: delivery.residentResponse,
        guardAssessment: delivery.guardAssessment,
        effectiveSafetyStatus: 'help_requested',
        safetyOutcome
      });

      if (reopenResult) {
        io.to(req.guard._id.toString()).emit('detection-status-updated', {
          detectionId: reopenResult._id,
          alertId: delivery.alertId,
          status: 'active',
          reopenedAt: new Date(),
          reason: reopenResult.statusHistory[reopenResult.statusHistory.length-1].reason
        });
      }
    }

    res.json({ success: true, delivery, safetyOutcome });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Resend notification
exports.resendSingle = async (req, res) => {
  const { resendNotification } = require('../services/notificationService');
  try {
    const delivery = await resendNotification(req.params.deliveryId, req.app.get('socketio'));
    res.json({ success: true, delivery });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
