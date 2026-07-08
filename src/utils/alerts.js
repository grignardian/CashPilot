/**
 * Budget Alerts Engine
 * Generates warnings when spending approaches or exceeds thresholds.
 */

const ALERTS_KEY = "cashpilot-alerts";
const SETTINGS_KEY = "cashpilot-alert-settings";

const defaultAlertSettings = {
  dailyLimitAlert: true,
  dailyThreshold: 0.75,
  monthlyLimitAlert: true,
  monthlyThreshold: 0.85,
  categoryLimitAlert: false,
  categoryLimits: {}
};

/**
 * Get alert settings from localStorage.
 * @returns {object} Alert configuration
 */
export function getAlertSettings() {
  try {
    return { ...defaultAlertSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return defaultAlertSettings;
  }
}

/**
 * Save alert settings.
 * @param {object} settings - Alert settings to persist
 */
export function saveAlertSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...defaultAlertSettings, ...settings }));
}

/**
 * Get all stored alerts.
 * @returns {Array} Alert objects
 */
export function getAlerts() {
  try {
    return JSON.parse(localStorage.getItem(ALERTS_KEY) || "[]");
  } catch {
    return [];
  }
}

/**
 * Save alerts to localStorage.
 * @param {Array} alerts
 */
function saveAlerts(alerts) {
  localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
}

/**
 * Check spending and generate alerts if thresholds are breached.
 * @param {object} params
 * @param {number} params.todaySpent - Total spent today
 * @param {number} params.monthSpent - Total spent this month
 * @param {number} params.safeDaily - Calculated safe daily spend
 * @param {number} params.budget - Monthly allowance
 * @param {number} params.savingsGoal - Savings target
 * @param {object} [params.settings] - Alert settings override
 * @returns {Array} New alerts generated
 */
export function checkAndGenerateAlerts({ todaySpent, monthSpent, safeDaily, budget, savingsGoal, settings }) {
  const config = settings || getAlertSettings();
  const newAlerts = [];
  const available = budget - savingsGoal;
  const now = new Date().toISOString();
  const todayKey = now.slice(0, 10);

  // Daily threshold check
  if (config.dailyLimitAlert && safeDaily > 0) {
    const dailyRatio = todaySpent / safeDaily;
    if (dailyRatio >= 1) {
      newAlerts.push(createAlert(
        "daily",
        "critical",
        `You've exceeded today's safe spend of ₹${Math.round(safeDaily)}. Spent: ₹${Math.round(todaySpent)}.`,
        { todaySpent, safeDaily, ratio: dailyRatio }
      ));
    } else if (dailyRatio >= config.dailyThreshold) {
      newAlerts.push(createAlert(
        "daily",
        "warning",
        `You've used ${Math.round(dailyRatio * 100)}% of today's budget (₹${Math.round(todaySpent)} of ₹${Math.round(safeDaily)}).`,
        { todaySpent, safeDaily, ratio: dailyRatio }
      ));
    }
  }

  // Monthly threshold check
  if (config.monthlyLimitAlert && available > 0) {
    const monthlyRatio = monthSpent / available;
    if (monthlyRatio >= 1) {
      newAlerts.push(createAlert(
        "monthly",
        "critical",
        `Monthly spending (₹${Math.round(monthSpent)}) has exceeded your available budget of ₹${Math.round(available)}.`,
        { monthSpent, available, ratio: monthlyRatio }
      ));
    } else if (monthlyRatio >= config.monthlyThreshold) {
      newAlerts.push(createAlert(
        "monthly",
        "warning",
        `You've used ${Math.round(monthlyRatio * 100)}% of this month's budget (₹${Math.round(monthSpent)} of ₹${Math.round(available)}).`,
        { monthSpent, available, ratio: monthlyRatio }
      ));
    }
  }

  // Persist new alerts (avoid duplicates for same day+type)
  if (newAlerts.length > 0) {
    const existing = getAlerts();
    const deduped = newAlerts.filter((alert) => {
      return !existing.some(
        (e) => e.type === alert.type && e.createdAt.slice(0, 10) === todayKey && !e.dismissed
      );
    });
    if (deduped.length > 0) {
      saveAlerts([...deduped, ...existing]);
    }
    return deduped;
  }

  return [];
}

/**
 * Get non-dismissed alerts from last 24 hours.
 * @returns {Array} Active alerts
 */
export function getDismissableAlerts() {
  const alerts = getAlerts();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return alerts.filter((a) => !a.dismissed && a.createdAt >= cutoff);
}

/**
 * Dismiss an alert by ID.
 * @param {string} alertId
 */
export function dismissAlert(alertId) {
  const alerts = getAlerts();
  const index = alerts.findIndex((a) => a.id === alertId);
  if (index !== -1) {
    alerts[index].dismissed = true;
    alerts[index].dismissedAt = new Date().toISOString();
    saveAlerts(alerts);
  }
}

/**
 * Clear alerts older than 7 days.
 */
export function clearOldAlerts() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const alerts = getAlerts().filter((a) => a.createdAt >= cutoff);
  saveAlerts(alerts);
}

// --- Helpers ---

function createAlert(type, severity, message, data) {
  return {
    id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    severity,
    message,
    data,
    dismissed: false,
    createdAt: new Date().toISOString()
  };
}
