const mongoose = require('mongoose');
const GuardNotification = require('../models/GuardNotification');

const getGuardId = (req) => req.guard._id;

const emitReadUpdate = (req, payload) => {
  const io = req.app.get('socketio');

  if (io) {
    io.to(getGuardId(req).toString()).emit('guard-notification:read', payload);
  }
};

exports.getNotifications = async (req, res, next) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const query = { guardId: getGuardId(req) };

    if (String(req.query.unreadOnly).toLowerCase() === 'true') {
      query.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      GuardNotification.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      GuardNotification.countDocuments(query),
      GuardNotification.countDocuments({
        guardId: getGuardId(req),
        isRead: false,
      }),
    ]);

    res.json({
      success: true,
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getUnreadCount = async (req, res, next) => {
  try {
    const unreadCount = await GuardNotification.countDocuments({
      guardId: getGuardId(req),
      isRead: false,
    });

    res.json({ success: true, unreadCount });
  } catch (error) {
    next(error);
  }
};

exports.markNotificationRead = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.notificationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID.',
      });
    }

    const notification = await GuardNotification.findOneAndUpdate(
      {
        _id: req.params.notificationId,
        guardId: getGuardId(req),
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found.',
      });
    }

    const unreadCount = await GuardNotification.countDocuments({
      guardId: getGuardId(req),
      isRead: false,
    });

    emitReadUpdate(req, {
      notificationId: notification._id,
      unreadCount,
    });

    return res.json({
      success: true,
      notification,
      unreadCount,
    });
  } catch (error) {
    return next(error);
  }
};

exports.markAllNotificationsRead = async (req, res, next) => {
  try {
    const readAt = new Date();

    await GuardNotification.updateMany(
      {
        guardId: getGuardId(req),
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt,
        },
      }
    );

    emitReadUpdate(req, {
      notificationId: null,
      all: true,
      unreadCount: 0,
      readAt,
    });

    res.json({
      success: true,
      unreadCount: 0,
      message: 'All notifications marked as read.',
    });
  } catch (error) {
    next(error);
  }
};
