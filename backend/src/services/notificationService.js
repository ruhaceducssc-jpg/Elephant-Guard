const User = require('../models/User');
const Guard = require('../models/Guard');
const Alert = require('../models/Alert');
const NotificationDelivery = require('../models/NotificationDelivery');
const { sendAlert } = require('./telegramService');
const { calculateDistance } = require('./geocodingService');
const { normalizeAlert, isPointInPolygon, evaluateAlertEligibility } = require('../utils/alertUtils');

/**
 * Triggers notifications for an alert
 * @param {object} alert - The alert document
 * @param {object} io - Socket.io instance
 */
const triggerAlertNotifications = async (alert, io) => {
  console.log(`--- [Notification Service] Starting trigger for Alert ${alert._id} ---`);
  
  const normalizedAlert = normalizeAlert(alert);

  try {
    // 1. Identify detecting guard and their patrol area
    const detectingGuard = await Guard.findById(alert.detectedBy);
    if (!detectingGuard) {
      console.error('Detecting guard not found for alert');
      await Alert.findByIdAndUpdate(alert._id, { 
        notificationStatus: 'none',
        eligibilityReason: 'detecting_guard_not_found'
      });
      return { success: false, error: 'Detecting guard not found' };
    }

    if (!detectingGuard.patrolArea || !detectingGuard.patrolArea.coordinates) {
      console.log(`Guard ${detectingGuard.name} has no patrol area configured. Skipping notifications.`);
      await Alert.findByIdAndUpdate(alert._id, { 
        notificationStatus: 'none',
        eligibilityReason: 'missing_guard_patrol_area'
      });
      return { success: true, status: 'none', count: 0 };
    }

    // 2. Check if elephant is inside guard patrol area
    const [lng, lat] = normalizedAlert.location.coordinates;
    const insideGuardArea = isPointInPolygon([lng, lat], detectingGuard.patrolArea);

    if (!insideGuardArea) {
      console.log('Elephant outside guard patrol area. No resident notifications.');
      await Alert.findByIdAndUpdate(alert._id, { 
        insidePatrolArea: false,
        notificationStatus: 'none',
        eligibilityReason: 'outside_guard_area'
      });
      return { success: true, status: 'none', count: 0 };
    }

    // 3. Find active residents REGISTERED BY THIS GUARD
    const residents = await User.find({ 
      registeredBy: alert.detectedBy
    });
    
    // 4. Evaluate eligibility for each resident
    const affectedResidentIds = [];
    const eligibleResidents = [];

    for (const resident of residents) {
      const evaluation = evaluateAlertEligibility({
        elephantLocation: normalizedAlert.location,
        guardPatrolArea: detectingGuard.patrolArea,
        resident
      });

      const deliveryData = {
        alertId: alert._id,
        residentId: resident._id,
        residentName: resident.name,
        phone: resident.phone,
        telegramChatId: resident.telegramChatId || 'NOT_SET',
        status: evaluation.eligible ? 'pending' : 'not_sent',
        reason: evaluation.reason,
        distanceFromElephant: evaluation.distanceToResidentMeters || 0,
        residentRadiusMeters: evaluation.residentRadiusMeters || resident.geofenceRadiusMeters,
        insideGuardArea: evaluation.insideGuardArea,
        insideResidentGeofence: evaluation.insideResidentGeofence,
        eligible: evaluation.eligible
      };

      const delivery = await NotificationDelivery.create(deliveryData);

      if (evaluation.eligible) {
        eligibleResidents.push({ resident, delivery });
        affectedResidentIds.push(resident._id);
      }
    }

    // 5. Find all guards to notify (Always notify guards regardless of polygon for safety)
    const guardsToNotify = await Guard.find({ 
      telegramChatId: { $exists: true, $ne: '' } 
    });

    // 6. Send messages and update delivery records
    let successCount = 0;
    const processedChatIds = new Set();

    // Notify Eligible Residents
    for (const { resident, delivery } of eligibleResidents) {
      if (processedChatIds.has(resident.telegramChatId)) {
        await NotificationDelivery.findByIdAndUpdate(delivery._id, {
          status: 'sent',
          sentAt: new Date(),
          reason: 'duplicate_chat_id_skipped'
        });
        successCount++;
        continue;
      }
      
      const result = await sendAlert(resident.telegramChatId, {
        ...normalizedAlert,
        distanceFromResident: delivery.distanceFromElephant,
        residentAreaName: resident.village
      });
      
      if (result.success) {
        successCount++;
        processedChatIds.add(resident.telegramChatId);
        await NotificationDelivery.findByIdAndUpdate(delivery._id, {
          status: 'sent',
          sentAt: new Date(),
          errorMessage: ''
        });
      } else {
        await NotificationDelivery.findByIdAndUpdate(delivery._id, {
          status: 'failed',
          errorMessage: result.error || 'Telegram API Error'
        });
      }
    }

    // Notify Guards
    for (const guard of guardsToNotify) {
      if (processedChatIds.has(guard.telegramChatId)) continue;
      
      const result = await sendAlert(guard.telegramChatId, normalizedAlert);
      if (result.success) {
        processedChatIds.add(guard.telegramChatId);
      }
    }

    // 7. Update Alert Status
    let status = 'none';
    if (successCount === eligibleResidents.length && eligibleResidents.length > 0) {
      status = 'sent';
    } else if (successCount > 0) {
      status = 'partial';
    } else if (eligibleResidents.length > 0) {
      status = 'failed';
    }

    const updatedAlert = await Alert.findByIdAndUpdate(alert._id, { 
      insidePatrolArea: true,
      notificationEligible: eligibleResidents.length > 0,
      eligibilityReason: eligibleResidents.length > 0 ? 'residents_matched' : 'no_residents_matched',
      notificationStatus: status,
      recipientCount: successCount,
      affectedResidentIds: affectedResidentIds,
      sentAt: new Date()
    }, { new: true }).populate('detectedBy', 'name');

    // Emit update via socket
    if (updatedAlert && io) {
      io.emit('alert-updated', normalizeAlert(updatedAlert));
    }

    console.log(`--- [Notification Service] Finished for Alert ${alert._id}. Status: ${status} ---`);
    return { success: true, status, count: successCount };
  } catch (err) {
    console.error(`--- [Notification Service] Critical Error for Alert ${alert._id} ---`);
    console.error(err);
    await Alert.findByIdAndUpdate(alert._id, { 
      notificationStatus: 'failed',
      eligibilityReason: 'service_error'
    });
    return { success: false, error: err.message };
  }
};


/**
 * Resends a specific notification
 */
const resendNotification = async (deliveryId, alertId, io) => {
  const delivery = await NotificationDelivery.findOne({ _id: deliveryId, alertId });
  if (!delivery) throw new Error('Delivery record not found');

  const alert = await Alert.findById(alertId).populate('detectedBy', 'name');
  if (!alert) throw new Error('Alert not found');

  // Fetch current resident data to get latest telegramChatId
  const resident = await User.findById(delivery.residentId);
  if (!resident) throw new Error('Resident not found');
  
  if (!resident.telegramChatId) {
    throw new Error('Resident still has no Telegram Chat ID linked');
  }

  // Update delivery record with latest chat ID if it was missing
  if (delivery.telegramChatId === 'NOT_SET') {
    delivery.telegramChatId = resident.telegramChatId;
  }

  const normalizedAlert = normalizeAlert(alert);
  const result = await sendAlert(resident.telegramChatId, {
    ...normalizedAlert,
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

  if (io) {
    io.emit('delivery-updated', delivery);
  }

  return delivery;
};

/**
 * Resends all failed notifications for an alert
 */
const resendAllFailed = async (alertId, io) => {
  const failedDeliveries = await NotificationDelivery.find({ 
    alertId, 
    status: { $in: ['failed', 'not_sent'] } 
  });
  
  if (failedDeliveries.length === 0) return [];

  const alert = await Alert.findById(alertId).populate('detectedBy', 'name');
  if (!alert) throw new Error('Alert not found');

  const normalizedAlert = normalizeAlert(alert);
  const results = [];

  for (const delivery of failedDeliveries) {
    // Fetch current resident data
    const resident = await User.findById(delivery.residentId);
    if (!resident || !resident.telegramChatId) continue;

    // Update delivery record with latest chat ID if it was missing
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

    if (io) {
      io.emit('delivery-updated', delivery);
    }
  }

  return results;
};

module.exports = {
  triggerAlertNotifications,
  resendNotification,
  resendAllFailed
};
