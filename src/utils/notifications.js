/**
 * Notification System
 * Manages in-app notifications for alerts, reminders, and achievements.
 */

const NOTIFICATIONS_KEY = "cashpilot-notifications";

/**
 * Get all notifications from localStorage.
 * @returns {Array} Notification objects
 */
export function getNotifications() {
  try {
    return JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveNotifications(notifications) {
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
}

/**
 * Create a new notification.
 * @param {string} type - 'alert' | 'reminder' | 'suggestion' | 'achievement'
 * @param {string} title - Short title
 * @param {string} message - Full message
 * @param {string} [severity] - 'info' | 'warning' | 'critical'
 * @returns {object} Created notification
 */
export function createNotification(type, title, message, severity = "info") {
  const notifications = getNotifications();
  const newNotification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    title,
    message,
    severity,
    read: false,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  };
  notifications.unshift(newNotification);
  saveNotifications(notifications);
  return newNotification;
}

/**
 * Get unread notifications.
 * @returns {object} { count, notifications }
 */
export function getUnreadNotifications() {
  const all = getNotifications();
  const unread = all.filter((n) => !n.read && n.expiresAt > new Date().toISOString());
  return { count: unread.length, notifications: unread };
}

/**
 * Mark a notification as read.
 * @param {string} notificationId
 */
export function markAsRead(notificationId) {
  const notifications = getNotifications();
  const index = notifications.findIndex((n) => n.id === notificationId);
  if (index !== -1) {
    notifications[index].read = true;
    saveNotifications(notifications);
  }
}

/**
 * Mark all notifications as read.
 */
export function markAllAsRead() {
  const notifications = getNotifications();
  notifications.forEach((n) => { n.read = true; });
  saveNotifications(notifications);
}

/**
 * Delete a notification.
 * @param {string} notificationId
 */
export function deleteNotification(notificationId) {
  const notifications = getNotifications().filter((n) => n.id !== notificationId);
  saveNotifications(notifications);
}

/**
 * Clear expired notifications.
 * @returns {number} Count of notifications removed
 */
export function clearExpiredNotifications() {
  const notifications = getNotifications();
  const now = new Date().toISOString();
  const valid = notifications.filter((n) => n.expiresAt > now);
  const removed = notifications.length - valid.length;
  saveNotifications(valid);
  return removed;
}
