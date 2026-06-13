const Alert = require('../models/Alert');
const NotificationDelivery = require('../models/NotificationDelivery');
const { getReadableLocation } = require('../services/geocodingService');
const { 
  triggerAlertNotifications, 
  resendNotification, 
  resendAllFailed 
} = require('../services/notificationService');
const { normalizeAlert, isPointInPolygon } = require('../utils/alertUtils');

// @desc    Create elephant alert
// @route   POST /api/alerts
// @access  Private
exports.createAlert = async (req, res) => {
  const { longitude, latitude, locationName, confidence, detectionSessionId } = req.body;
  const image = req.file ? req.file.filename : '';

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ message: 'Invalid GPS coordinates' });
  }

  // Configuration for deduplication
  const ALERT_DEDUPE_WINDOW_MS = parseInt(process.env.ALERT_DEDUPE_WINDOW_MS) || 60000;
  const ALERT_DEDUPE_DISTANCE_METERS = parseInt(process.env.ALERT_DEDUPE_DISTANCE_METERS) || 100;

  try {
    // 1. Check for an existing alert with the same detectionSessionId (Idempotency)
    if (detectionSessionId) {
      const existingById = await Alert.findOne({ detectionSessionId });
      if (existingById) {
        console.log(`Duplicate detectionSessionId detected: ${detectionSessionId}`);
        return res.status(200).json({
          ...normalizeAlert(existingById),
          duplicate: true,
          message: 'Detection event already processed'
        });
      }
    }

    // 2. Secondary deduplication check (Time and Location fallback)
    const timeWindow = new Date(Date.now() - ALERT_DEDUPE_WINDOW_MS);
    const existingNear = await Alert.findOne({
      detectedBy: req.guard ? req.guard._id : null,
      detectedAt: { $gte: timeWindow },
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: ALERT_DEDUPE_DISTANCE_METERS
        }
      }
    });

    if (existingNear) {
      console.log('Similar recent alert detected by backend nearby, skipping creation');
      return res.status(200).json({
        ...normalizeAlert(existingNear),
        duplicate: true,
        message: 'A similar alert was recently reported nearby'
      });
    }

    // Check if point is inside guard's patrol area
    let insidePatrolArea = false;
    if (req.guard && req.guard.patrolArea) {
      insidePatrolArea = isPointInPolygon([lng, lat], req.guard.patrolArea);
    }

    let finalLocationName = locationName;
    if (!finalLocationName || finalLocationName === 'Unknown Location' || finalLocationName === 'Live Patrol Scan' || finalLocationName === 'Analyzed Gallery Upload' || finalLocationName === 'Automated Detection' || finalLocationName === 'Manual Deployment') {
      finalLocationName = await getReadableLocation(lat, lng);
    }

    const alertData = {
      image,
      location: {
        type: 'Point',
        coordinates: [lng, lat],
        locationName: finalLocationName,
      },
      confidence: parseFloat(confidence) || 0,
      detectedBy: req.guard ? req.guard._id : null,
      insidePatrolArea,
      detectionSessionId
    };

    const alert = await Alert.create(alertData);

    const populatedAlert = await Alert.findById(alert._id).populate('detectedBy', 'name');
    const normalizedAlert = normalizeAlert(populatedAlert);

    // Emit socket event for real-time dashboard (only to the guard who detected it)
    const io = req.app.get('socketio');
    if (io && req.guard) {
      io.to(req.guard._id.toString()).emit('new-elephant-alert', normalizedAlert);
    }

    // Trigger notifications in background and wait for initial summary
    const notificationResult = await triggerAlertNotifications(populatedAlert, io);

    res.status(201).json({
      success: true,
      alert: normalizedAlert,
      summary: {
        insideGuardArea: normalizedAlert.insidePatrolArea,
        status: notificationResult.status,
        count: notificationResult.count
      }
    });
  } catch (error) {
    // Handle MongoDB duplicate key error (code 11000) for detectionSessionId
    if (error.code === 11000 && error.keyPattern && error.keyPattern.detectionSessionId) {
      console.log(`Concurrent duplicate detectionSessionId handled: ${detectionSessionId}`);
      const existingAlert = await Alert.findOne({ detectionSessionId });
      return res.status(200).json({
        ...normalizeAlert(existingAlert),
        duplicate: true,
        message: 'Detection event already processed (concurrent)'
      });
    }
    
    console.error('Create alert error:', error);
    res.status(400).json({ message: error.message });
  }
};

// @desc    Resend a specific notification delivery
// @route   POST /api/alerts/:id/notifications/:deliveryId/resend
// @access  Private
exports.resendNotification = async (req, res) => {
  try {
    const { id, deliveryId } = req.params;
    const io = req.app.get('socketio');
    
    const delivery = await resendNotification(deliveryId, id, io);
    res.json(delivery);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Resend all failed notifications for an alert
// @route   POST /api/alerts/:id/notifications/resend-failed
// @access  Private
exports.resendAllFailedNotifications = async (req, res) => {
  try {
    const { id } = req.params;
    const io = req.app.get('socketio');
    
    const results = await resendAllFailed(id, io);
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all notification deliveries
// @route   GET /api/alerts/notifications
// @access  Private
exports.getAllNotifications = async (req, res) => {
  try {
    // Only show notifications for alerts created by this guard
    const alerts = await Alert.find({ detectedBy: req.guard._id }).select('_id');
    const alertIds = alerts.map(a => a._id);

    const notifications = await NotificationDelivery.find({ alertId: { $in: alertIds } })
      .sort('-createdAt')
      .limit(200);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get notification deliveries for an alert
// @route   GET /api/alerts/:id/notifications
// @access  Private
exports.getAlertNotifications = async (req, res) => {
  try {
    // Verify alert ownership/permission
    const alert = await Alert.findOne({ _id: req.params.id, detectedBy: req.guard._id });
    if (!alert) return res.status(403).json({ message: 'Not authorized to view these logs' });

    const notifications = await NotificationDelivery.find({ alertId: req.params.id })
      .sort('residentName');
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all alerts with filtering
// @route   GET /api/alerts
// @access  Public
exports.getAlerts = async (req, res) => {
  const { status, areaName, minConfidence, dateFrom, dateTo, search } = req.query;
  
  // Scope to current guard
  let query = { detectedBy: req.guard._id };
  
  if (status && status !== 'all') query.alertStatus = status;
  if (minConfidence) query.confidence = { $gte: parseFloat(minConfidence) };
  
  if (dateFrom || dateTo) {
    query.detectedAt = {};
    if (dateFrom) query.detectedAt.$gte = new Date(dateFrom);
    if (dateTo) query.detectedAt.$lte = new Date(dateTo);
  }

  if (search) {
    query['location.locationName'] = { $regex: search, $options: 'i' };
  } else if (areaName) {
    query['location.locationName'] = { $regex: areaName, $options: 'i' };
  }

  try {
    const alerts = await Alert.find(query).sort('-detectedAt')
      .populate('detectedBy', 'name')
      .populate('affectedResidentIds', 'name');
    
    const normalizedAlerts = alerts.map(alert => normalizeAlert(alert));
    res.json(normalizedAlerts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update alert status
// @route   PATCH /api/alerts/:id/status
// @access  Private
exports.updateAlertStatus = async (req, res) => {
  const { status } = req.body;

  try {
    const alert = await Alert.findById(req.params.id).populate('detectedBy', 'name');

    if (alert) {
      alert.alertStatus = status;
      const updatedAlert = await alert.save();
      const normalizedAlert = normalizeAlert(updatedAlert);

      const io = req.app.get('socketio');
      if (io) {
        io.emit('alert-updated', normalizedAlert);
      }

      res.json(normalizedAlert);
    } else {
      res.status(404).json({ message: 'Alert not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update alert notes
// @route   PATCH /api/alerts/:id/notes
// @access  Private
exports.updateAlertNotes = async (req, res) => {
  const { notes } = req.body;

  try {
    const alert = await Alert.findById(req.params.id).populate('detectedBy', 'name');

    if (alert) {
      alert.notes = notes;
      const updatedAlert = await alert.save();
      res.json(normalizeAlert(updatedAlert));
    } else {
      res.status(404).json({ message: 'Alert not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get single alert
// @route   GET /api/alerts/:id
// @access  Public
exports.getAlertById = async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id)
      .populate('detectedBy', 'name')
      .populate('affectedResidentIds', 'name');

    if (alert) {
      res.json(normalizeAlert(alert));
    } else {
      res.status(404).json({ message: 'Alert not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete alert
// @route   DELETE /api/alerts/:id
// @access  Private
exports.deleteAlert = async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);
    if (alert) {
      await alert.deleteOne();
      res.json({ message: 'Alert removed' });
    } else {
      res.status(404).json({ message: 'Alert not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Send a test telegram notification
// @route   POST /api/alerts/notifications/test
// @access  Private
exports.testNotification = async (req, res) => {
  try {
    const { chatId } = req.body;
    if (!chatId) return res.status(400).json({ message: 'Chat ID required' });

    const { sendAlert } = require('../services/telegramService');
    const result = await sendAlert(chatId, {
      id: 'test',
      locationName: 'Test Connectivity Node',
      areaName: 'Test Connectivity Node',
      detectedAt: new Date(),
      confidence: 1.0,
      latitude: 7.8731,
      longitude: 80.7718,
      distanceFromResident: 0
    });

    if (result.success) {
      res.json({ message: 'Test notification sent' });
    } else {
      res.status(500).json({ message: result.error || 'Failed to send test' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
