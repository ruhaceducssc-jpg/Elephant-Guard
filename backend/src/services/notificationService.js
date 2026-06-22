const User = require('../models/User');
const Guard = require('../models/Guard');
const Detection = require('../models/Detection');
const Alert = require('../models/Alert');
const NotificationDelivery = require('../models/NotificationDelivery');
const { sendAlert } = require('./telegramService');
const {
  canAttemptAutomaticDelivery,
  evaluateAlertEligibility,
  isPointInPolygon,
  isResidentOwnedByGuard,
  isValidCoordinatePair,
  normalizeAlert,
  normalizeDetection,
  normalizePatrolArea,
} = require('../utils/alertUtils');

const getBoundaryState = (guard) => {
  if (!guard?.patrolArea?.coordinates?.[0]) {
    return {
      valid: false,
      reason: 'guard_boundary_missing',
      patrolArea: null,
    };
  }

  try {
    return {
      valid: true,
      reason: '',
      patrolArea: normalizePatrolArea(guard.patrolArea),
    };
  } catch (error) {
    console.error(`Invalid patrol boundary for guard ${guard._id}:`, error.message);
    return {
      valid: false,
      reason: 'invalid_guard_boundary',
      patrolArea: null,
    };
  }
};

const getBaseEvaluation = (reason, insideGuardArea = false) => ({
  eligible: false,
  reason,
  insideGuardArea,
  insideResidentGeofence: false,
});

const createOrUpdateDelivery = async ({
  alert,
  detection,
  resident,
  evaluation,
}) => {
  const deliveryFields = {
    alertId: alert._id,
    detectionId: detection._id,
    guardId: detection.guardId,
    residentId: resident._id,
    telegramChatId: String(resident.telegramChatId || '').trim(),
    distanceToDetectionMeters: Number.isFinite(evaluation.distanceToResidentMeters)
      ? evaluation.distanceToResidentMeters
      : null,
    residentSnapshot: {
      name: resident.name,
      phone: resident.phone,
      telegramChatId: resident.telegramChatId,
      village: resident.village,
      location: resident.areaLocation,
      geofenceRadiusMeters: resident.geofenceRadiusMeters,
    },
    residentGeofenceRadiusMeters: Number.isFinite(evaluation.residentRadiusMeters)
      ? evaluation.residentRadiusMeters
      : null,
    insideGuardArea: evaluation.insideGuardArea,
    insideGuardBoundary: evaluation.insideGuardArea,
    insideResidentGeofence: evaluation.insideResidentGeofence,
    eligibilityStatus: evaluation.reason,
  };

  let delivery = await NotificationDelivery.findOne({
    detectionId: detection._id,
    residentId: resident._id,
  });

  if (!delivery) {
    try {
      delivery = await NotificationDelivery.create({
        ...deliveryFields,
        notificationStatus: evaluation.eligible ? 'pending' : 'not_sent',
        errorMessage: evaluation.eligible ? '' : evaluation.reason,
      });
      return delivery;
    } catch (error) {
      if (error.code !== 11000) throw error;
      delivery = await NotificationDelivery.findOne({
        detectionId: detection._id,
        residentId: resident._id,
      });
    }
  }

  if (!delivery) {
    throw new Error('Failed to create or retrieve notification delivery');
  }

  Object.assign(delivery, deliveryFields);

  if (delivery.notificationStatus !== 'sent' && !delivery.automaticAttemptedAt) {
    delivery.notificationStatus = evaluation.eligible ? 'pending' : 'not_sent';
    delivery.errorMessage = evaluation.eligible ? '' : evaluation.reason;
  }

  await delivery.save();
  return delivery;
};

const claimAutomaticDelivery = async (delivery) => {
  if (!canAttemptAutomaticDelivery(delivery)) return null;

  return NotificationDelivery.findOneAndUpdate(
    {
      _id: delivery._id,
      automaticAttemptedAt: null,
      notificationStatus: 'pending',
    },
    {
      $set: {
        automaticAttemptedAt: new Date(),
        notificationStatus: 'retrying',
      },
    },
    { new: true }
  );
};

const updateAlertSummary = async (alert, residentCount) => {
  const deliveries = await NotificationDelivery.find({ detectionId: alert.detectionId });
  const eligibleCount = deliveries.filter(
    (delivery) => delivery.eligibilityStatus === 'inside_both_areas'
  ).length;

  alert.linkedResidentCount = residentCount;
  alert.eligibleResidentCount = eligibleCount;
  alert.notificationSummary = {
    sent: deliveries.filter((delivery) => delivery.notificationStatus === 'sent').length,
    failed: deliveries.filter((delivery) => delivery.notificationStatus === 'failed').length,
    pending: deliveries.filter(
      (delivery) => delivery.notificationStatus === 'pending'
        || delivery.notificationStatus === 'retrying'
    ).length,
    not_sent: deliveries.filter((delivery) => delivery.notificationStatus === 'not_sent').length,
  };
  await alert.save();

  return {
    deliveries,
    eligibleCount,
    sentCount: alert.notificationSummary.sent,
  };
};

/**
 * Triggers automatic notifications for one confirmed detection.
 *
 * Required rule:
 * inside guard patrol boundary AND inside resident geofence = eligible.
 */
const triggerAlertNotifications = async (detection, io) => {
  console.log(`--- [Notification Service] Starting trigger for Detection ${detection._id} ---`);

  try {
    const detectingGuard = await Guard.findById(detection.guardId);
    if (!detectingGuard) {
      console.error('Detecting guard not found for detection');
      return { success: false, status: 'guard_not_found', error: 'Detecting guard not found' };
    }

    let alert;
    try {
      alert = await Alert.create({
        detectionId: detection._id,
        guardId: detection.guardId,
        location: {
          type: 'Point',
          coordinates: [...detection.location.coordinates],
        },
        detectedAt: detection.detectedAt,
        status: 'active',
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      alert = await Alert.findOne({ detectionId: detection._id });
    }

    if (!alert) {
      throw new Error('Failed to create or find related alert');
    }

    if (!detection.alertId || String(detection.alertId) !== String(alert._id)) {
      detection.alertId = alert._id;
    }

    const detectionCoordinates = detection.location?.coordinates;
    const boundaryState = getBoundaryState(detectingGuard);
    const validDetectionLocation = isValidCoordinatePair(detectionCoordinates);
    const insideGuardArea = validDetectionLocation
      && boundaryState.valid
      && isPointInPolygon(detectionCoordinates, boundaryState.patrolArea);

    detection.insideGuardArea = insideGuardArea;
    await detection.save();

    const residents = await User.find({ registeredBy: detection.guardId });
    const eligibleDeliveries = [];

    for (const resident of residents) {
      if (!isResidentOwnedByGuard(resident, detection.guardId)) {
        console.warn(
          `Skipped resident ${resident._id}: ownership does not match detection guard ${detection.guardId}`
        );
        continue;
      }

      let evaluation;
      if (!validDetectionLocation) {
        evaluation = getBaseEvaluation('invalid_detection_location');
      } else if (!boundaryState.valid) {
        evaluation = getBaseEvaluation(boundaryState.reason);
      } else if (!insideGuardArea) {
        evaluation = getBaseEvaluation('outside_guard_boundary');
      } else {
        evaluation = evaluateAlertEligibility({
          elephantLocation: detection.location,
          guardPatrolArea: boundaryState.patrolArea,
          resident,
        });
      }

      try {
        const delivery = await createOrUpdateDelivery({
          alert,
          detection,
          resident,
          evaluation,
        });

        if (evaluation.eligible) {
          eligibleDeliveries.push({ resident, delivery });
        }
      } catch (error) {
        console.error(`Failed to process resident ${resident._id}:`, error.message);
      }
    }

    for (const { resident, delivery } of eligibleDeliveries) {
      const claimedDelivery = await claimAutomaticDelivery(delivery);
      if (!claimedDelivery) continue;

      try {
        const result = await sendAlert(resident.telegramChatId, {
          deliveryId: claimedDelivery._id,
          detectionId: detection._id,
          residentId: resident._id,
          areaName: detection.locationName,
          detectedAt: detection.detectedAt,
          confidence: detection.confidence,
          latitude: detection.location.coordinates[1],
          longitude: detection.location.coordinates[0],
          distanceFromResident: claimedDelivery.distanceToDetectionMeters,
          residentAreaName: resident.village,
        });

        if (result.success) {
          claimedDelivery.notificationStatus = 'sent';
          claimedDelivery.sentAt = new Date();
          claimedDelivery.failedAt = null;
          claimedDelivery.telegramMessageId = result.messageId;
          claimedDelivery.errorMessage = '';
        } else {
          claimedDelivery.notificationStatus = 'failed';
          claimedDelivery.failedAt = new Date();
          claimedDelivery.errorMessage = result.error || 'Telegram API Error';
        }
      } catch (error) {
        claimedDelivery.notificationStatus = 'failed';
        claimedDelivery.failedAt = new Date();
        claimedDelivery.errorMessage = error.message;
      }

      await claimedDelivery.save();
    }

    const summary = await updateAlertSummary(alert, residents.length);

    if (io) {
      const payload = {
        success: true,
        detection: normalizeDetection(detection),
        alert: normalizeAlert(alert),
      };
      io.emit('new-elephant-detection', payload);
      io.to(detection.guardId.toString()).emit('detection-created', payload);
    }

    const status = !validDetectionLocation
      ? 'invalid_detection_location'
      : !boundaryState.valid
        ? boundaryState.reason
        : !insideGuardArea
          ? 'outside_guard_boundary'
          : 'completed';

    console.log(
      `--- [Notification Service] Finished. Sent: ${summary.sentCount}/${summary.eligibleCount}; status: ${status} ---`
    );

    return {
      success: true,
      status,
      count: summary.sentCount,
      eligibleCount: summary.eligibleCount,
    };
  } catch (error) {
    console.error('--- [Notification Service] Critical Error ---', error);
    return { success: false, error: error.message, status: 'error' };
  }
};

const resendNotification = async (deliveryId, io, guardId) => {
  const delivery = await NotificationDelivery.findOne({
    _id: deliveryId,
    ...(guardId ? { guardId } : {}),
  });
  if (!delivery) throw new Error('Delivery record not found');

  const detection = await Detection.findById(delivery.detectionId);
  const resident = await User.findOne({
    _id: delivery.residentId,
    registeredBy: delivery.guardId,
  });

  if (!detection || String(detection.guardId) !== String(delivery.guardId)) {
    throw new Error('Detection ownership mismatch');
  }

  if (!resident || !String(resident.telegramChatId || '').trim()) {
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
    residentAreaName: resident.village,
  });

  if (result.success) {
    delivery.notificationStatus = 'sent';
    delivery.sentAt = new Date();
    delivery.failedAt = null;
    delivery.errorMessage = '';
    delivery.telegramMessageId = result.messageId;
  } else {
    delivery.notificationStatus = 'failed';
    delivery.failedAt = new Date();
    delivery.errorMessage = result.error || 'Retry failed';
  }

  await delivery.save();
  if (io) io.to(delivery.guardId.toString()).emit('delivery-updated', delivery);
  return delivery;
};

module.exports = {
  claimAutomaticDelivery,
  createOrUpdateDelivery,
  resendNotification,
  triggerAlertNotifications,
};
