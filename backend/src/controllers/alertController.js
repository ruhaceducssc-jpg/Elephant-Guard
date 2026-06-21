const Detection = require('../models/Detection');
const Alert = require('../models/Alert');
const NotificationDelivery = require('../models/NotificationDelivery');
const { getReadableLocation, calculateDistance } = require('../services/geocodingService');
const { 
  triggerAlertNotifications, 
  resendNotification 
} = require('../services/notificationService');
const { normalizeDetection, isPointInPolygon } = require('../utils/alertUtils');
const { manualClearDetection } = require('../services/detectionStatusService');
const { generateDetectionExport } = require('../services/detectionExportService');

// @desc    Create elephant detection and alert
// @route   POST /api/detections
// @access  Private
exports.createAlert = async (req, res) => {
  const { longitude, latitude, locationName, confidence, detectionSessionId, source } = req.body;
  const image = req.file ? req.file.filename : '';

  // 1. Validation & Parsing
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  const conf = parseFloat(confidence) || 0;
  const guardId = req.guard?._id;

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ success: false, message: 'Valid GPS coordinates are required' });
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ success: false, message: 'GPS coordinates are out of valid range' });
  }

  if (!guardId) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  // Generate a unique session ID if not provided to prevent compound index collisions on (guardId, null)
  const sessionId = detectionSessionId || `manual-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

  try {
    // 2. Idempotency Check
    const existing = await Detection.findOne({ guardId, detectionSessionId: sessionId });
    if (existing) {
      return res.status(200).json({
        ...normalizeDetection(existing),
        duplicate: true,
        message: 'Detection event already processed'
      });
    }

    // 3. Determine Patrol Area Boundary
    let insideGuardArea = false;
    if (req.guard && req.guard.patrolArea) {
      insideGuardArea = isPointInPolygon([lng, lat], req.guard.patrolArea);
    }

    let finalLocationName = locationName;
    if (!finalLocationName || ['Unknown Location', 'Live Patrol Scan', 'Analyzed Gallery Upload', 'Automated Detection', 'Manual Deployment'].includes(finalLocationName)) {
      try {
        finalLocationName = await getReadableLocation(lat, lng);
      } catch (geoErr) {
        console.warn('Geocoding fallback:', geoErr.message);
        finalLocationName = 'Sector Analyzed';
      }
    }

    // 4. Create Detection Record
    const detectionData = {
      guardId,
      detectionSessionId: sessionId,
      source: source || (detectionSessionId ? 'camera' : 'upload'),
      imageUrl: image,
      confidence: conf,
      location: { 
        type: 'Point', 
        coordinates: [lng, lat] 
      },
      locationName: finalLocationName || 'Sector Analyzed',
      insideGuardArea,
      status: 'active'
    };

    console.log(`Creating detection for guard ${guardId} at ${lng}, ${lat}`);
    const detection = await Detection.create(detectionData);

    // 5. Trigger Notifications (Async background work)
    const io = req.app.get('socketio');
    let notificationResult = { success: true, status: 'none' };
    
    try {
      notificationResult = await triggerAlertNotifications(detection, io);
    } catch (notifError) {
      console.error('Notification background failure:', notifError);
      notificationResult = { success: false, status: 'failed', error: notifError.message };
    }

    // Return success
    return res.status(201).json({
      success: true,
      duplicate: false,
      detection: normalizeDetection(detection),
      notificationStatus: notificationResult.status || 'none',
      message: notificationResult.success ? 'Elephant detection created successfully.' : 'Detection saved, but notifications encountered issues.'
    });

  } catch (error) {
    // Detailed Duplicate Key Error Handling
    if (error.code === 11000) {
      console.log('Duplicate detection attempt detected via MongoDB index');
      const existing = await Detection.findOne({ guardId, detectionSessionId: sessionId });
      if (existing) {
        return res.status(200).json({
          ...normalizeDetection(existing),
          duplicate: true,
          message: 'Detection already exists'
        });
      }
    }
    
    console.error('CRITICAL: Create detection error:', error);
    return res.status(400).json({ 
      success: false,
      message: 'Failed to create detection record',
      error: error.message,
      details: error.errors ? Object.keys(error.errors).map(k => error.errors[k].message) : undefined
    });
  }
};

// @desc    Get all detections for the guard
// @route   GET /api/detections
// @access  Private
exports.getAlerts = async (req, res) => {
  const { status, search } = req.query;
  let query = { guardId: req.guard._id };
  
  if (status && status !== 'all') query.status = status;
  if (search) query.locationName = { $regex: search, $options: 'i' };

  try {
    const detections = await Detection.find(query).sort('-detectedAt').populate('alertId');
    res.json(detections.map(d => normalizeDetection(d)));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Export detections and linked resident outcomes
// @route   GET /api/detections/export
// @access  Private
exports.exportDetections = async (req, res) => {
  try {
    const exportFile = await generateDetectionExport({
      guardId: req.guard._id,
      query: req.query,
    });

    res.setHeader('Content-Type', exportFile.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportFile.filename}"`);
    res.setHeader('Content-Length', exportFile.buffer.length);
    return res.send(exportFile.buffer);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 500
        ? 'Failed to export detection data. Please try again.'
        : error.message,
    });
  }
};

// @desc    Get linked residents and safety summary for a detection
// @route   GET /api/detections/:id/residents
// @access  Private
exports.getDetectionResidents = async (req, res) => {
  const getEffectiveSafetyStatus = (delivery) => {
    if (delivery.guardAssessment?.status && delivery.guardAssessment.status !== 'pending') {
      return delivery.guardAssessment.status;
    }
    return delivery.residentResponse?.status || 'pending';
  };

  try {
    const detection = await Detection.findOne({ _id: req.params.id, guardId: req.guard._id });
    if (!detection) return res.status(404).json({ message: 'Detection not found' });

    const deliveries = await NotificationDelivery.find({ detectionId: detection._id })
      .populate('residentId', 'name phone telegramChatId village areaLocation geofenceRadiusMeters')
      .sort('createdAt');
    
    // Recalculate distance if zero/missing and save it
    for (let delivery of deliveries) {
      if (!delivery.distanceToDetectionMeters || delivery.distanceToDetectionMeters === 0) {
        const detectionLoc = detection.location?.coordinates;
        const residentLoc = delivery.residentSnapshot?.location?.coordinates || delivery.residentId?.areaLocation?.coordinates;

        if (detectionLoc && residentLoc && Array.isArray(detectionLoc) && Array.isArray(residentLoc)) {
          const dist = calculateDistance(
            detectionLoc[1], detectionLoc[0],
            residentLoc[1], residentLoc[0]
          );
          
          if (dist !== null) {
            delivery.distanceToDetectionMeters = Math.round(dist);
            await delivery.save();
          }
        }
      }
    }

    const summary = {
      linkedResidents: deliveries.length,
      sentSuccessfully: deliveries.filter(d => d.notificationStatus === 'sent').length,
      helpRequests: deliveries.filter(d => getEffectiveSafetyStatus(d) === 'help_requested').length
    };

    const safetyOutcome = {
      protected: deliveries.filter(d => getEffectiveSafetyStatus(d) === 'protected').length,
      pending: deliveries.filter(d => getEffectiveSafetyStatus(d) === 'pending').length,
      attackedOrCannotProtect: deliveries.filter(d => {
        const status = getEffectiveSafetyStatus(d);
        return status === 'attacked' || status === 'cannot_protect';
      }).length,
      requiredHelp: summary.helpRequests
    };

    res.json({
      success: true,
      notificationSummary: summary,
      safetyOutcome,
      linkedResidents: deliveries
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update alert status
// @route   PATCH /api/detections/:id/status
// @access  Private
exports.updateAlertStatus = async (req, res) => {
  const { status } = req.body;
  try {
    const detection = await Detection.findOneAndUpdate(
      { _id: req.params.id, guardId: req.guard._id },
      { status },
      { new: true }
    );
    if (detection) {
      res.json(normalizeDetection(detection));
    } else {
      res.status(404).json({ message: 'Detection not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Resend a specific notification
// @route   POST /api/detections/notifications/:deliveryId/resend
// @access  Private
exports.resendNotification = async (req, res) => {
  try {
    const delivery = await resendNotification(req.params.deliveryId, req.app.get('socketio'));
    res.json(delivery);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Send a test telegram notification
// @route   POST /api/detections/notifications/test
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

// @desc    Clear alert manually by guard
// @route   PATCH /api/detections/:id/clear
// @access  Private
exports.clearAlert = async (req, res) => {
  const { reason } = req.body;
  try {
    const detection = await manualClearDetection(req.params.id, req.guard._id, reason);
    
    if (detection) {
      // Emit socket event
      const io = req.app.get('socketio');
      if (io) {
        io.to(req.guard._id.toString()).emit('detection-status-updated', {
          detectionId: detection._id,
          alertId: detection.alertId,
          status: 'cleared',
          clearedAt: detection.clearedAt,
          clearedBy: 'guard',
          clearReason: detection.clearReason
        });
      }
      res.json(normalizeDetection(detection));
    } else {
      res.status(404).json({ message: 'Detection not found or already cleared' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getAlertById = async (req, res) => {
  try {
    const detection = await Detection.findOne({ _id: req.params.id, guardId: req.guard._id }).populate('alertId');
    if (detection) {
      res.json(normalizeDetection(detection));
    } else {
      res.status(404).json({ message: 'Detection not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteAlert = async (req, res) => {
  try {
    const detection = await Detection.findOne({ _id: req.params.id, guardId: req.guard._id });
    if (detection) {
      await Alert.deleteMany({ detectionId: detection._id });
      await NotificationDelivery.deleteMany({ detectionId: detection._id });
      await detection.deleteOne();
      res.json({ message: 'Detection record removed' });
    } else {
      res.status(404).json({ message: 'Detection not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
