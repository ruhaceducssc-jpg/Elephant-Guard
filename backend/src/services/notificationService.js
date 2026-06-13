const User = require('../models/User');
const Guard = require('../models/Guard');
const Detection = require('../models/Detection');
const Alert = require('../models/Alert');
const NotificationDelivery = require('../models/NotificationDelivery');
const { sendAlert } = require('./telegramService');
const { isPointInPolygon, evaluateAlertEligibility, normalizeDetection, normalizeAlert } = require('../utils/alertUtils');

/**
 * Triggers notifications for a detection
 * @param {object} detection - The detection document
 * @param {object} io - Socket.io instance
 */
const triggerAlertNotifications = async (detection, io) => {
  console.log(`--- [Notification Service] Starting trigger for Detection ${detection._id} ---`);
  
  try {
    // 1. Identify detecting guard
    const detectingGuard = await Guard.findById(detection.guardId);
    if (!detectingGuard) {
      console.error('Detecting guard not found for detection');
      return { success: false, error: 'Detecting guard not found' };
    }

    // 2. Create the Alert record (One-Detection-One-Alert)
    let alert;
    try {
      alert = await Alert.create({
        detectionId: detection._id,
        guardId: detection.guardId,
        location: {
          type: 'Point',
          coordinates: [
            detection.location.coordinates[0],
            detection.location.coordinates[1]
          ]
        },
        detectedAt: detection.detectedAt,
        status: 'active'
      });
    } catch (alertError) {
      if (alertError.code === 11000) {
        alert = await Alert.findOne({ detectionId: detection._id });
      } else {
        throw alertError;
      }
    }

    if (!alert) {
      throw new Error('Failed to create or find related alert');
    }

    // Link alert to detection if not already linked
    if (!detection.alertId || detection.alertId.toString() !== alert._id.toString()) {
      detection.alertId = alert._id;
      await detection.save();
    }

    // 3. Check if guard has patrol area
    if (!detectingGuard.patrolArea || !detectingGuard.patrolArea.coordinates) {
      console.log(`Guard ${detectingGuard.name} has no patrol area. No notifications sent.`);
      
      // Still emit socket event so map updates
      if (io) {
        io.emit('new-elephant-detection', {
          detection: normalizeDetection(detection),
          alert: normalizeAlert(alert)
        });
      }
      
      return { success: true, status: 'none', count: 0 };
    }

    // 4. Find active residents registered by this guard
    const residents = await User.find({ registeredBy: detection.guardId });
    
    // 5. Evaluate eligibility and create delivery records
    let eligibleCount = 0;
    const eligibleResidents = [];

    for (const resident of residents) {
      try {
        const evaluation = evaluateAlertEligibility({
          elephantLocation: detection.location,
          guardPatrolArea: detectingGuard.patrolArea,
          resident
        });

        // Use upsert-like behavior for deliveries to prevent duplicates
        const delivery = await NotificationDelivery.findOneAndUpdate(
          { alertId: alert._id, residentId: resident._id },
          {
            detectionId: detection._id,
            guardId: detection.guardId,
            notificationStatus: evaluation.eligible ? 'pending' : 'not_sent',
            safetyStatus: 'pending',
            telegramChatId: resident.telegramChatId || 'NOT_SET',
            distanceToDetectionMeters: evaluation.distanceToResidentMeters || 0,
            residentSnapshot: {
              name: resident.name,
              phone: resident.phone,
              telegramChatId: resident.telegramChatId,
              village: resident.village,
              location: resident.areaLocation,
              geofenceRadiusMeters: resident.geofenceRadiusMeters
            },
            residentGeofenceRadiusMeters: evaluation.residentRadiusMeters || resident.geofenceRadiusMeters,
            insideGuardArea: evaluation.insideGuardArea,
            insideResidentGeofence: evaluation.insideResidentGeofence,
            errorMessage: evaluation.eligible ? '' : evaluation.reason
          },
          { upsert: true, new: true }
        );

        if (evaluation.eligible) {
          eligibleCount++;
          eligibleResidents.push({ resident, delivery });
        }
      } catch (delError) {
        console.error(`Failed to process resident ${resident._id}:`, delError.message);
      }
    }

    // 6. Update Alert counts
    alert.linkedResidentCount = residents.length;
    alert.eligibleResidentCount = eligibleCount;
    await alert.save();

    // 7. Send Telegram messages (Don't let one failure block others)
    let successCount = 0;
    const processedChatIds = new Set();

    for (const { resident, delivery } of eligibleResidents) {
      if (!resident.telegramChatId || resident.telegramChatId === 'NOT_SET') {
        delivery.notificationStatus = 'failed';
        delivery.errorMessage = 'Missing Telegram Chat ID';
        await delivery.save();
        continue;
      }

      if (processedChatIds.has(resident.telegramChatId)) {
        delivery.notificationStatus = 'sent';
        delivery.sentAt = new Date();
        delivery.errorMessage = 'duplicate_chat_id_skipped';
        await delivery.save();
        successCount++;
        continue;
      }
      
      try {
        const result = await sendAlert(resident.telegramChatId, {
          deliveryId: delivery._id,
          detectionId: detection._id,
          residentId: resident._id,
          areaName: detection.locationName,
          detectedAt: detection.detectedAt,
          confidence: detection.confidence,
          latitude: detection.location.coordinates[1],
          longitude: detection.location.coordinates[0],
          distanceFromResident: delivery.distanceToDetectionMeters,
          residentAreaName: resident.village
        });
        
        if (result.success) {
          successCount++;
          processedChatIds.add(resident.telegramChatId);
          delivery.notificationStatus = 'sent';
          delivery.sentAt = new Date();
          delivery.telegramMessageId = result.messageId;
        } else {
          delivery.notificationStatus = 'failed';
          delivery.failedAt = new Date();
          delivery.errorMessage = result.error || 'Telegram API Error';
        }
        await delivery.save();
      } catch (telError) {
        console.error(`Telegram send error for ${resident.name}:`, telError.message);
        delivery.notificationStatus = 'failed';
        delivery.errorMessage = telError.message;
        await delivery.save();
      }
    }

    // 8. Final Alert Summary Update
    alert.notificationSummary = {
      sent: successCount,
      failed: eligibleCount - successCount,
      pending: 0,
      not_sent: residents.length - eligibleCount
    };
    await alert.save();

    // Emit socket events with normalized data
    if (io) {
      const payload = {
        success: true,
        detection: normalizeDetection(detection),
        alert: normalizeAlert(alert)
      };
      // Target specific guard room and broadcast
      io.emit('new-elephant-detection', payload);
      io.to(detection.guardId.toString()).emit('detection-created', payload);
    }

    console.log(`--- [Notification Service] Finished. Sent: ${successCount}/${eligibleCount} ---`);
    return { success: true, status: 'completed', count: successCount };
  } catch (err) {
    console.error(`--- [Notification Service] Critical Error ---`, err);
    return { success: false, error: err.message, status: 'error' };
  }
};

/**
 * Resends a specific notification
 */
const resendNotification = async (deliveryId, io) => {
  const delivery = await NotificationDelivery.findById(deliveryId);
  if (!delivery) throw new Error('Delivery record not found');

  const detection = await Detection.findById(delivery.detectionId);
  const resident = await User.findById(delivery.residentId);
  
  if (!resident || !resident.telegramChatId) {
    throw new Error('Resident has no Telegram Chat ID linked');
  }

  const result = await sendAlert(resident.telegramChatId, {
    deliveryId: delivery._id,
    detectionId: delivery.detectionId,
    residentId: resident._id,
    areaName: detection.locationName,
    detectedAt: detection.detectedAt,
    confidence: detection.confidence,
    latitude: detection.location.coordinates[1],
    longitude: detection.location.coordinates[0],
    distanceFromResident: delivery.distanceToDetectionMeters,
    residentAreaName: resident.village
  });

  if (result.success) {
    delivery.notificationStatus = 'sent';
    delivery.sentAt = new Date();
    delivery.errorMessage = '';
  } else {
    delivery.notificationStatus = 'failed';
    delivery.errorMessage = result.error || 'Retry failed';
  }

  await delivery.save();
  if (io) io.emit('delivery-updated', delivery);
  return delivery;
};

module.exports = {
  triggerAlertNotifications,
  resendNotification
};
