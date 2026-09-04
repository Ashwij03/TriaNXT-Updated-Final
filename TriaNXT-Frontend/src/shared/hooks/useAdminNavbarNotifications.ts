import { useEffect, useState } from "react";
import {
  ADMIN_NOTIFICATIONS_EVENT,
  dispatchAdminNotificationsUpdated,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
} from "../services/adminService";

export function useAdminNavbarNotifications() {
  const [notifications, setNotifications] = useState(getNotifications);

  const refresh = () => setNotifications(getNotifications());

  useEffect(() => {
    window.addEventListener(ADMIN_NOTIFICATIONS_EVENT, refresh);
    return () => window.removeEventListener(ADMIN_NOTIFICATIONS_EVENT, refresh);
  }, []);

  const unreadCount = notifications.filter((item) => !item.read).length;

  const handleToggleRead = (notification) => {
    if (!notification?.id) {
      return;
    }

    if (notification.read) {
      markNotificationUnread(notification.id);
    } else {
      markNotificationRead(notification.id);
    }
  };

  const handleMarkAllRead = () => {
    markAllNotificationsRead();
    dispatchAdminNotificationsUpdated();
  };

  return {
    notifications,
    unreadCount,
    handleToggleRead,
    handleMarkAllRead,
    refresh,
  };
}
