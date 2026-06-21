import api from './api';

export const getNotifications = (params = {}) => (
  api.get('/notifications', { params }).then((response) => response.data)
);

export const getUnreadNotificationCount = () => (
  api.get('/notifications/unread-count').then((response) => response.data)
);

export const markNotificationRead = (notificationId) => (
  api.patch(`/notifications/${notificationId}/read`).then((response) => response.data)
);

export const markAllNotificationsRead = () => (
  api.patch('/notifications/read-all').then((response) => response.data)
);
