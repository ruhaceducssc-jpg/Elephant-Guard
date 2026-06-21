const GuardNotification = require('../models/GuardNotification');

const notificationDetailsByStatus = {
  protected: {
    type: 'resident_protected',
    title: 'Resident marked Protected',
    label: 'Protected',
  },
  help_requested: {
    type: 'resident_help_request',
    title: 'Resident requested Help',
    label: 'Need Help',
  },
  cannot_protect: {
    type: 'resident_cannot_protect',
    title: 'Resident cannot protect themselves',
    label: "Can't Protect",
  },
};

const getDetectionLocation = (detection, resident) => (
  detection?.locationName
  || resident?.areaLocation?.areaName
  || resident?.village
  || 'the reported detection area'
);

const createResidentReplyNotification = async ({
  delivery,
  resident,
  detection,
  residentStatus,
  repliedAt,
  io,
}) => {
  const details = notificationDetailsByStatus[residentStatus];

  if (!details || !delivery?.guardId || !delivery?._id) {
    throw new Error('Cannot create guard notification from incomplete resident reply data');
  }

  const residentSnapshot = {
    name: resident?.name || delivery.residentSnapshot?.name || 'Registered resident',
    phone: resident?.phone || delivery.residentSnapshot?.phone || '',
    telegramChatId:
      resident?.telegramChatId
      || delivery.residentSnapshot?.telegramChatId
      || delivery.telegramChatId
      || '',
    village: resident?.village || delivery.residentSnapshot?.village || '',
  };

  const locationName = getDetectionLocation(detection, resident);
  const notificationData = {
    guardId: delivery.guardId,
    residentId: resident?._id || delivery.residentId || null,
    detectionId: detection?._id || delivery.detectionId || null,
    alertId: delivery.alertId || null,
    deliveryId: delivery._id,
    type: details.type,
    title: details.title,
    message: `${residentSnapshot.name} replied "${details.label}" for the elephant alert near ${locationName}.`,
    residentSnapshot,
    detectionSnapshot: {
      locationName,
      detectedAt: detection?.detectedAt || null,
    },
    residentReply: {
      status: residentStatus,
      label: details.label,
      repliedAt,
    },
    isRead: false,
    readAt: null,
  };

  const notification = await GuardNotification.findOneAndUpdate(
    {
      guardId: delivery.guardId,
      deliveryId: delivery._id,
      'residentReply.status': residentStatus,
    },
    {
      $set: notificationData,
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  const unreadCount = await GuardNotification.countDocuments({
    guardId: delivery.guardId,
    isRead: false,
  });

  if (io) {
    io.to(delivery.guardId.toString()).emit('guard-notification:new', {
      notification: notification.toObject(),
      unreadCount,
    });
  }

  return { notification, unreadCount };
};

module.exports = {
  createResidentReplyNotification,
};
