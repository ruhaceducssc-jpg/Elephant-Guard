const Alert = require('../models/Alert');
const User = require('../models/User');
const Guard = require('../models/Guard');
const NotificationDelivery = require('../models/NotificationDelivery');
const { sendAlert } = require('../services/telegramService');
const axios = require('axios');

/**
 * Get readable location name from coordinates
 */
const getReadableLocation = async (lat, lng) => {
  try {
    // Attempt using OpenStreetMap Nominatim (Free, no key required for low volume)
    const response = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`, {
      headers: { 'User-Agent': 'ElephantAlertSriLanka/1.0' }
    });
    
    if (response.data && response.data.display_name) {
      const addr = response.data.address;
      // Build a friendly name: Village/Suburb, Town/City
      const main = addr.suburb || addr.village || addr.neighbourhood || addr.hamlet || addr.town || 'Unknown Area';
      const secondary = addr.city || addr.county || addr.state_district || '';
      return secondary ? `${main}, ${secondary}` : main;
    }
  } catch (err) {
    console.error('Reverse geocoding error:', err.message);
  }
  
  // Fallback to coordinates if geocoding fails
  return `Area near ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
};

/**
 * Calculate distance between two points in meters using Haversine formula
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
          Math.cos(phi1) * Math.cos(phi2) *
          Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// @desc    Create elephant alert
// @route   POST /api/alerts
// @access  Private
exports.createAlert = async (req, res) => {
  const { longitude, latitude, locationName, confidence } = req.body;
  // Store only the filename, not the full path
  const image = req.file ? req.file.filename : '';

  // Validate coordinates
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ message: 'Invalid GPS coordinates' });
  }

  try {
    // Enhance location name with reverse geocoding if not provided
    let finalLocationName = locationName;
    if (!finalLocationName || finalLocationName === 'Unknown Location') {
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
      detectedBy: req.guard._id,
    });

    // Populate detectedBy to ensure the dashboard gets the guard name instantly
    const populatedAlert = await Alert.findById(alert._id).populate('detectedBy', 'name');
    
    // Normalize alert object for frontend and notifications
    const alertObj = populatedAlert.toObject();
    const normalizedAlert = {
      ...alertObj,
      id: alertObj._id,
      latitude: lat,
      longitude: lng,
      areaName: alertObj.location.locationName,
      locationName: alertObj.location.locationName,
    };

    // Emit socket event for real-time dashboard
    const io = req.app.get('socketio');
    if (io) {
      io.emit('new-elephant-alert', normalizedAlert);
    }

    // --- TELEGRAM NOTIFICATIONS WITH DELIVERY TRACKING ---
    const triggerNotifications = async () => {
      console.log('--- DEBUG: Starting Notification Trigger (Tracking Mode) ---');
      let status = 'pending';
      
      try {
        // 1. Find ALL residents with telegramChatId and notification enabled
        const allResidents = await User.find({ 
          telegramChatId: { $exists: true, $ne: '' },
          notificationEnabled: true
        });
        
        // 2. Filter residents by geofence
        const affectedResidents = [];
        const affectedResidentIds = [];
        
        for (const resident of allResidents) {
          const resLng = resident.areaLocation.coordinates[0];
          const resLat = resident.areaLocation.coordinates[1];
          const radius = resident.geofenceRadiusMeters || 1000;
          
          const distance = calculateDistance(lat, lng, resLat, resLng);
          
          if (distance <= radius) {
            affectedResidents.push({
              ...resident.toObject(),
              distanceToElephant: distance
            });
            affectedResidentIds.push(resident._id);
          }
        }

        // 3. Create Pending Delivery Records for residents
        const deliveryPromises = affectedResidents.map(resident => 
          NotificationDelivery.create({
            alertId: alert._id,
            residentId: resident._id,
            residentName: resident.name,
            telegramChatId: resident.telegramChatId,
            status: 'pending',
            distanceFromElephant: resident.distanceToElephant
          })
        );
        const deliveries = await Promise.all(deliveryPromises);

        // 4. Find all guards
        const guardsToNotify = await Guard.find({ 
          telegramChatId: { $exists: true, $ne: '' } 
        });

        // 5. Send messages to affected residents and update delivery records
        let successCount = 0;
        const processedChatIds = new Set();

        // Notify Affected Residents
        for (let i = 0; i < affectedResidents.length; i++) {
          const resident = affectedResidents[i];
          const delivery = deliveries[i];

          if (processedChatIds.has(resident.telegramChatId)) {
            await NotificationDelivery.findByIdAndUpdate(delivery._id, {
              status: 'sent',
              sentAt: new Date(),
              errorMessage: 'Duplicate chat ID skipped'
            });
            continue;
          }
          
          const result = await sendAlert(resident.telegramChatId, {
            ...normalizedAlert,
            distanceFromResident: resident.distanceToElephant,
            residentAreaName: resident.areaLocation.areaName
          });
          
          if (result.success) {
            successCount++;
            processedChatIds.add(resident.telegramChatId);
            await NotificationDelivery.findByIdAndUpdate(delivery._id, {
              status: 'sent',
              sentAt: new Date()
            });
          } else {
            await NotificationDelivery.findByIdAndUpdate(delivery._id, {
              status: 'failed',
              errorMessage: result.error || 'Unknown Telegram Error'
            });
          }
        }

        // Notify Guards
        for (const guard of guardsToNotify) {
          if (processedChatIds.has(guard.telegramChatId)) continue;
          
          const result = await sendAlert(guard.telegramChatId, normalizedAlert);
          if (result.success) {
            successCount++;
            processedChatIds.add(guard.telegramChatId);
          }
        }

        const totalRecipients = processedChatIds.size;
        
        // Update final status on Alert
        if (successCount === totalRecipients && totalRecipients > 0) {
          status = 'sent';
        } else if (successCount > 0) {
          status = 'partial';
        } else {
          status = 'failed';
        }

        const updatedAlert = await Alert.findByIdAndUpdate(alert._id, { 
          notificationStatus: status,
          recipientCount: successCount,
          affectedResidentIds: affectedResidentIds,
          sentAt: new Date()
        }, { new: true }).populate('detectedBy', 'name');

        // Emit update to frontend
        if (updatedAlert && io) {
          const upObj = updatedAlert.toObject();
          const upNorm = {
            ...upObj,
            id: upObj._id,
            latitude: lat,
            longitude: lng,
            areaName: upObj.location.locationName,
            locationName: upObj.location.locationName,
          };
          io.emit('alert-updated', upNorm);
        }

        console.log(`--- DEBUG: Finished Notification Trigger. Status: ${status}, Sent: ${successCount} ---`);
      } catch (err) {
        console.error('--- DEBUG ERROR in triggerNotifications ---');
        console.error(err);
        await Alert.findByIdAndUpdate(alert._id, { notificationStatus: 'failed' });
      }
    };

    // Execute notifications
    triggerNotifications();

    res.status(201).json(normalizedAlert);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Send a test telegram notification
// @route   POST /api/alerts/notifications/test
// @access  Private
exports.testNotification = async (req, res) => {
  try {
    const { chatId } = req.body;
    if (!chatId) return res.status(400).json({ message: 'Chat ID required' });

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

// @desc    Resend a specific notification delivery
// @route   POST /api/alerts/:id/notifications/:deliveryId/resend
// @access  Private
exports.resendNotification = async (req, res) => {
  try {
    const { id, deliveryId } = req.params;
    
    // 1. Find delivery record
    const delivery = await NotificationDelivery.findOne({ _id: deliveryId, alertId: id });
    if (!delivery) {
      return res.status(404).json({ message: 'Delivery record not found' });
    }

    // 2. Find alert for context
    const alert = await Alert.findById(id).populate('detectedBy', 'name');
    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }

    // Normalize alert for Telegram service
    const alertObj = alert.toObject();
    const normalizedAlert = {
      ...alertObj,
      id: alertObj._id,
      latitude: alertObj.location.coordinates[1],
      longitude: alertObj.location.coordinates[0],
      areaName: alertObj.location.locationName,
      locationName: alertObj.location.locationName,
      distanceFromResident: delivery.distanceFromElephant // Use stored distance
    };

    // 3. Resend via Telegram
    const result = await sendAlert(delivery.telegramChatId, normalizedAlert);

    // 4. Update delivery record
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

    // 5. Emit socket update
    const io = req.app.get('socketio');
    if (io) {
      io.emit('delivery-updated', delivery);
    }

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
    
    // 1. Find all failed delivery records
    const failedDeliveries = await NotificationDelivery.find({ alertId: id, status: 'failed' });
    if (failedDeliveries.length === 0) {
      return res.json({ message: 'No failed deliveries to resend' });
    }

    // 2. Find alert
    const alert = await Alert.findById(id).populate('detectedBy', 'name');
    const alertObj = alert.toObject();
    const normalizedAlert = {
      ...alertObj,
      id: alertObj._id,
      latitude: alertObj.location.coordinates[1],
      longitude: alertObj.location.coordinates[0],
      areaName: alertObj.location.locationName,
      locationName: alertObj.location.locationName,
    };

    const results = [];
    const io = req.app.get('socketio');

    // 3. Loop and resend
    for (const delivery of failedDeliveries) {
      const resendResult = await sendAlert(delivery.telegramChatId, {
        ...normalizedAlert,
        distanceFromResident: delivery.distanceFromElephant
      });

      delivery.retryCount += 1;
      delivery.lastRetryAt = new Date();

      if (resendResult.success) {
        delivery.status = 'sent';
        delivery.sentAt = new Date();
        delivery.errorMessage = '';
      } else {
        delivery.errorMessage = resendResult.error || 'Retry failed';
      }

      await delivery.save();
      results.push(delivery);

      if (io) {
        io.emit('delivery-updated', delivery);
      }
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all notification deliveries across all alerts
// @route   GET /api/alerts/notifications
// @access  Private
exports.getAllNotifications = async (req, res) => {
  try {
    const notifications = await NotificationDelivery.find()
      .sort('-createdAt')
      .limit(100); // Limit to latest 100 for performance
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

  if (status) query.alertStatus = status;
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
    
    // Normalize all alerts
    const normalizedAlerts = alerts.map(alert => {
      const alertObj = alert.toObject();
      return {
        ...alertObj,
        id: alertObj._id,
        latitude: alertObj.location.coordinates[1],
        longitude: alertObj.location.coordinates[0],
        areaName: alertObj.location.locationName,
        locationName: alertObj.location.locationName,
      };
    });
    
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
      
      const alertObj = updatedAlert.toObject();
      const normalizedAlert = {
        ...alertObj,
        id: alertObj._id,
        latitude: alertObj.location.coordinates[1],
        longitude: alertObj.location.coordinates[0],
        areaName: alertObj.location.locationName,
        locationName: alertObj.location.locationName,
      };

      // Notify clients of status change
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

      const alertObj = updatedAlert.toObject();
      const normalizedAlert = {
        ...alertObj,
        id: alertObj._id,
        latitude: alertObj.location.coordinates[1],
        longitude: alertObj.location.coordinates[0],
        areaName: alertObj.location.locationName,
        locationName: alertObj.location.locationName,
      };

      // Notify clients of notes change
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

// @desc    Get single alert
// @route   GET /api/alerts/:id
// @access  Public
exports.getAlertById = async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id)
      .populate('detectedBy', 'name')
      .populate('affectedResidentIds', 'name');

    if (alert) {
      const alertObj = alert.toObject();
      const normalizedAlert = {
        ...alertObj,
        id: alertObj._id,
        latitude: alertObj.location.coordinates[1],
        longitude: alertObj.location.coordinates[0],
        areaName: alertObj.location.locationName,
        locationName: alertObj.location.locationName,
      };
      res.json(normalizedAlert);
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
