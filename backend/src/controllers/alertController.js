const Alert = require('../models/Alert');
const NotificationDelivery = require('../models/NotificationDelivery');
const { getReadableLocation } = require('../services/geocodingService');
const { 
  triggerAlertNotifications, 
  resendNotification, 
  resendAllFailed 
} = require('../services/notificationService');
const { normalizeAlert } = require('../utils/alertUtils');

// @desc    Create elephant alert
// @route   POST /api/alerts
// @access  Private
exports.createAlert = async (req, res) => {
  const { longitude, latitude, locationName, confidence } = req.body;
  const image = req.file ? req.file.filename : '';

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ message: 'Invalid GPS coordinates' });
  }

  try {
    let finalLocationName = locationName;
    if (!finalLocationName || finalLocationName === 'Unknown Location' || finalLocationName === 'Live Patrol Scan' || finalLocationName === 'Analyzed Gallery Upload') {
      finalLocationName = await getReadableLocation(lat, lng);
    }

    const alert = await Alert.create({
      image,
      location: {
        type: 'Point',
        coordinates: [lng, lat],
        locationName: finalLocationName,
      },
      confidence: parseFloat(confidence) || 0,
      detectedBy: req.guard ? req.guard._id : null,
    });

    const populatedAlert = await Alert.findById(alert._id).populate('detectedBy', 'name');
    const normalizedAlert = normalizeAlert(populatedAlert);

    // Emit socket event for real-time dashboard
    const io = req.app.get('socketio');
    if (io) {
      io.emit('new-elephant-alert', normalizedAlert);
    }

    // Trigger notifications in background
    triggerAlertNotifications(populatedAlert, io);

    res.status(201).json(normalizedAlert);
  } catch (error) {
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
    const notifications = await NotificationDelivery.find()
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
  
  let query = {};
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
