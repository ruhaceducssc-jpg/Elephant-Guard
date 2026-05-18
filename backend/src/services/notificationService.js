const User = require('../models/User');
const Guard = require('../models/Guard');
const Alert = require('../models/Alert');
const NotificationDelivery = require('../models/NotificationDelivery');
const { sendAlert } = require('./telegramService');
const { calculateDistance } = require('./geocodingService');
const { normalizeAlert } = require('../utils/alertUtils');

/**
 * Triggers notifications for an alert
 * @param {object} alert - The alert document
 * @param {object} io - Socket.io instance
 */
const triggerAlertNotifications = async (alert, io) => {
  console.log(`--- [Notification Service] Starting trigger for Alert ${alert._id} ---`);
  
  const normalizedAlert = normalizeAlert(alert);

  try {
    // 1. Find ALL active residents
    const allResidents = await User.find({ 
      notificationEnabled: true
    });
    
    // 2. Filter residents by geofence
    const affectedResidents = [];
    const affectedResidentIds = [];
    
    for (const resident of allResidents) {
      if (!resident.areaLocation || !resident.areaLocation.coordinates) continue;

      const resLng = resident.areaLocation.coordinates[0];
      const resLat = resident.areaLocation.coordinates[1];
      const radius = resident.geofenceRadiusMeters || 1000;
      
      const distance = calculateDistance(normalizedAlert.latitude, normalizedAlert.longitude, resLat, resLng);
      
      if (distance <= radius) {
        affectedResidents.push({
          ...resident.toObject(),
          distanceToElephant: distance
        });
        affectedResidentIds.push(resident._id);
      }
    }

    // 3. Create Delivery Records for ALL affected residents
    const deliveries = await Promise.all(affectedResidents.map(resident => {
      const initialStatus = !resident.telegramChatId ? 'not_sent' : 'pending';
      const initialError = !resident.telegramChatId ? 'Telegram Chat ID missing' : '';
      
      return NotificationDelivery.create({
        alertId: alert._id,
        residentId: resident._id,
        residentName: resident.name,
        phone: resident.phone,
        telegramChatId: resident.telegramChatId || 'NOT_SET',
        status: initialStatus,
        errorMessage: initialError,
        distanceFromElephant: resident.distanceToElephant
      });
    }));

    // 4. Find all guards to notify
    const guardsToNotify = await Guard.find({ 
      telegramChatId: { $exists: true, $ne: '' } 
    });

    // 5. Send messages and update delivery records
    let successCount = 0;
    const processedChatIds = new Set();

    // Notify Affected Residents
    for (let i = 0; i < affectedResidents.length; i++) {
      const resident = affectedResidents[i];
      const delivery = deliveries[i];

      // Skip those already marked as not_sent (missing chat id)
      if (delivery.status === 'not_sent') continue;

      if (processedChatIds.has(resident.telegramChatId)) {
        await NotificationDelivery.findByIdAndUpdate(delivery._id, {
          status: 'sent',
          sentAt: new Date(),
          errorMessage: 'Duplicate chat ID skipped'
        });
        successCount++;
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

    // 6. Update Alert Status
    let status = 'failed';
    const totalPossible = affectedResidents.filter(r => r.telegramChatId).length;
    
    if (successCount === totalPossible && totalPossible > 0) {
      status = 'sent';
    } else if (successCount > 0) {
      status = 'partial';
    } else if (affectedResidents.length === 0) {
      status = 'none';
    } else if (totalPossible === 0) {
      status = 'failed'; // No one had a chat ID
    }

    const updatedAlert = await Alert.findByIdAndUpdate(alert._id, { 
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
    await Alert.findByIdAndUpdate(alert._id, { notificationStatus: 'failed' });
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
