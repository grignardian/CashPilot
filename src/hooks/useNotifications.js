import { useCallback, useEffect, useState } from "react";
import {
  clearExpiredNotifications,
  createNotification,
  deleteNotification,
  getUnreadNotifications,
  markAllAsRead,
  markAsRead
} from "../utils/notifications";

/**
 * Hook for managing the notification system.
 * Provides unread count, CRUD, and auto-cleanup.
 *
 * @returns {object} Notification state and actions
 */
export function useNotifications() {
  const [unread, setUnread] = useState({ count: 0, notifications: [] });

  const refresh = useCallback(() => {
    setUnread(getUnreadNotifications());
  }, []);

  // Clean expired and refresh on mount
  useEffect(() => {
    clearExpiredNotifications();
    refresh();
  }, [refresh]);

  const add = useCallback((type, title, message, severity) => {
    const notif = createNotification(type, title, message, severity);
    refresh();
    return notif;
  }, [refresh]);

  const read = useCallback((id) => {
    markAsRead(id);
    refresh();
  }, [refresh]);

  const readAll = useCallback(() => {
    markAllAsRead();
    refresh();
  }, [refresh]);

  const remove = useCallback((id) => {
    deleteNotification(id);
    refresh();
  }, [refresh]);

  return {
    unreadCount: unread.count,
    notifications: unread.notifications,
    add,
    read,
    readAll,
    remove,
    refresh
  };
}
