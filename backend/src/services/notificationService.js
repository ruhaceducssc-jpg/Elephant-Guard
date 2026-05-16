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
      
      const distance = calculateDistance(normalizedAlert.latitude, normalizedAlert.longitude, resLat, resLng);
      
      if (distance <= radius) {
        affectedResidents.push({
          ...resident.toObject(),
          distanceToElephant: distance
        });
        affectedResidentIds.push(resident._id);
      }
    }

    // 3. Create Pending Delivery Records
    const deliveries = await Promise.all(affectedResidents.map(resident => 
      NotificationDelivery.create({
        alertId: alert._id,
        residentId: resident._id,
        residentName: resident.name,
        telegramChatId: resident.telegramChatId,
        status: 'pending',
        distanceFromElephant: resident.distanceToElephant
      })
    ));

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
    if (successCount === affectedResidents.length && affectedResidents.length > 0) {
      status = 'sent';
    } else if (successCount > 0) {
      status = 'partial';
    } else if (affectedResidents.length === 0) {
      status = 'none'; // No residents in geofence
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

  const normalizedAlert = normalizeAlert(alert);
  const result = await sendAlert(delivery.telegramChatId, {
    ...normalizedAlert,
    distanceFromResident: delivery.distanceFromElephant
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
  const failedDeliveries = await NotificationDelivery.find({ alertId, status: 'failed' });
  if (failedDeliveries.length === 0) return [];

  const alert = await Alert.findById(alertId).populate('detectedBy', 'name');
  if (!alert) throw new Error('Alert not found');

  const normalizedAlert = normalizeAlert(alert);
  const results = [];

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

  return results;
};

module.exports = {
  triggerAlertNotifications,
  resendNotification,
  resendAllFailed
};
