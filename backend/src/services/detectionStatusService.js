const Detection = require('../models/Detection');
const Alert = require('../models/Alert');
const NotificationDelivery = require('../models/NotificationDelivery');

/**
 * Normalizes effective safety status for a delivery
 */
const getEffectiveSafetyStatus = (delivery) => {
  if (
    delivery.residentResponse?.status === 'help_requested' ||
    delivery.guardAssessment?.status === 'help_requested'
  ) {
    return 'help_requested';
  }

  if (delivery.guardAssessment?.status === 'attacked') {
    return 'attacked';
  }

  if (delivery.residentResponse?.status === 'cannot_protect') {
    return 'cannot_protect';
  }

  if (
    delivery.guardAssessment?.status === 'protected' ||
    delivery.residentResponse?.status === 'protected'
  ) {
    return 'protected';
  }

  return 'pending';
};

/**
 * Evaluates whether a detection should be automatically cleared
 */
const evaluateAndClearDetection = async (detectionId, triggerInfo = {}) => {
  try {
    const detection = await Detection.findById(detectionId);
    if (!detection || detection.status === 'cleared') return null;

    const deliveries = await NotificationDelivery.find({ detectionId });
    if (deliveries.length === 0) return null;

    const statuses = deliveries.map(getEffectiveSafetyStatus);
    const allProtected = statuses.every(s => s === 'protected');

    if (allProtected) {
      const oldStatus = detection.status;
      detection.status = 'cleared';
      detection.clearedAt = new Date();
      detection.clearedBy = 'automatic';
      detection.clearReason = 'All linked residents confirmed protected.';
      
      detection.statusHistory.push({
        from: oldStatus,
        to: 'cleared',
        source: 'resident_response',
        residentId: triggerInfo.residentId,
        deliveryId: triggerInfo.deliveryId,
        reason: detection.clearReason
      });

      await detection.save();

      // Sync Alert Status
      await Alert.findOneAndUpdate({ detectionId: detection._id }, { status: 'cleared' });

      return {
        cleared: true,
        detection
      };
    }

    return { cleared: false };
  } catch (error) {
    console.error('Error in evaluateAndClearDetection:', error);
    return null;
  }
};

/**
 * Manually clears a detection by a guard
 */
const manualClearDetection = async (detectionId, guardId, reason) => {
  try {
    const detection = await Detection.findById(detectionId);
    if (!detection || detection.status === 'cleared') return null;

    const oldStatus = detection.status;
    detection.status = 'cleared';
    detection.clearedAt = new Date();
    detection.clearedBy = 'guard';
    detection.clearedByGuardId = guardId;
    detection.clearReason = reason || 'Cleared by guard action.';

    detection.statusHistory.push({
      from: oldStatus,
      to: 'cleared',
      source: 'guard_action',
      guardId: guardId,
      reason: detection.clearReason
    });

    await detection.save();

    // Sync Alert Status
    await Alert.findOneAndUpdate({ detectionId: detection._id }, { status: 'cleared' });

    return detection;
  } catch (error) {
    console.error('Error in manualClearDetection:', error);
    return null;
  }
};

/**
 * Reopens a detection to active status
 */
const reopenDetection = async (detectionId, reason, triggerInfo = {}) => {
  try {
    const detection = await Detection.findById(detectionId);
    if (!detection || detection.status === 'active') return null;

    const oldStatus = detection.status;
    detection.status = 'active';
    detection.clearedAt = null;
    detection.clearedBy = null;
    detection.clearedByGuardId = null;
    
    detection.statusHistory.push({
      from: oldStatus,
      to: 'active',
      source: triggerInfo.source || 'system',
      residentId: triggerInfo.residentId,
      deliveryId: triggerInfo.deliveryId,
      guardId: triggerInfo.guardId,
      reason: reason || 'Reopened due to new safety response.'
    });

    await detection.save();

    // Sync Alert Status
    await Alert.findOneAndUpdate({ detectionId: detection._id }, { status: 'active' });

    return detection;
  } catch (error) {
    console.error('Error in reopenDetection:', error);
    return null;
  }
};

module.exports = {
  evaluateAndClearDetection,
  manualClearDetection,
  getEffectiveSafetyStatus,
  reopenDetection
};
