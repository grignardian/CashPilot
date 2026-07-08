/**
 * Data Management Utility
 * Monthly recaps, data cleanup, storage monitoring, and session tracking.
 */

const RECAPS_KEY = "cashpilot-monthly-recaps";
const SESSION_KEY = "cashpilot-session-metadata";

/**
 * Generate a monthly recap for the given month.
 * @param {number} month - 0-indexed month
 * @param {number} year
 * @param {Array} expenses - All expense transactions
 * @param {number} budget - Monthly allowance
 * @param {number} savingsGoal - Savings target
 * @param {object} [prevRecap] - Previous month recap for comparison
 * @returns {object} Monthly recap
 */
export function generateMonthlyRecap(month, year, expenses, budget, savingsGoal, prevRecap = null) {
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthExpenses = expenses.filter(
    (tx) => tx.type === "expense" && (tx.dateKey || "").startsWith(monthKey)
  );

  const totalSpent = monthExpenses.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const savingsAchieved = Math.max(0, budget - totalSpent);
  const goalMet = savingsAchieved >= savingsGoal;

  // Top category
  const byCat = {};
  monthExpenses.forEach((tx) => {
    const cat = tx.category || "Other";
    byCat[cat] = (byCat[cat] || 0) + Number(tx.amount || 0);
  });
  const topCategoryEntry = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  const topCategory = topCategoryEntry
    ? { name: topCategoryEntry[0], amount: topCategoryEntry[1], percentage: Math.round((topCategoryEntry[1] / totalSpent) * 100) }
    : { name: "None", amount: 0, percentage: 0 };

  // Top single expense
  const sorted = [...monthExpenses].sort((a, b) => Number(b.amount) - Number(a.amount));
  const topExpense = sorted[0]
    ? { name: sorted[0].note || sorted[0].category, amount: Number(sorted[0].amount), date: sorted[0].dateKey }
    : null;

  // Days with spending
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const averageDailySpend = totalSpent / daysInMonth;

  // Comparison to previous month
  const trends = {};
  if (prevRecap) {
    const spentDiff = totalSpent - prevRecap.totalSpent;
    trends.comparedToLastMonth = {
      spent: spentDiff,
      percent: prevRecap.totalSpent > 0 ? Math.round((spentDiff / prevRecap.totalSpent) * 100) : 0
    };
  }

  return {
    monthKey,
    month: new Date(year, month).toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    totalSpent: Math.round(totalSpent),
    savingsAchieved: Math.round(savingsAchieved),
    savingsGoal,
    goalMet,
    savingsPercentage: budget > 0 ? Math.round((savingsAchieved / budget) * 1000) / 10 : 0,
    topCategory,
    topExpense,
    averageDailySpend: Math.round(averageDailySpend),
    transactionCount: monthExpenses.length,
    trends
  };
}

/**
 * Save a monthly recap to localStorage.
 * @param {object} recap - Monthly recap object
 */
export function saveMonthlyRecap(recap) {
  const recaps = getMonthlyRecaps();
  recaps[recap.monthKey] = recap;

  // Keep only last 24 months
  const keys = Object.keys(recaps).sort().reverse();
  const trimmed = {};
  keys.slice(0, 24).forEach((key) => { trimmed[key] = recaps[key]; });

  localStorage.setItem(RECAPS_KEY, JSON.stringify(trimmed));
}

/**
 * Get all monthly recaps.
 * @returns {object} Keyed by monthKey "YYYY-MM"
 */
export function getMonthlyRecaps() {
  try {
    return JSON.parse(localStorage.getItem(RECAPS_KEY) || "{}");
  } catch {
    return {};
  }
}

/**
 * Calculate localStorage usage for CashPilot keys.
 * @returns {object} Storage usage breakdown
 */
export function calculateStorageUsage() {
  const cashpilotKeys = [];
  let totalBytes = 0;
  const breakdown = {};

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("cashpilot")) {
      const value = localStorage.getItem(key) || "";
      const bytes = new Blob([value]).size;
      cashpilotKeys.push(key);
      breakdown[key] = bytes;
      totalBytes += bytes;
    }
  }

  const limitBytes = 5 * 1024 * 1024; // 5MB

  return {
    totalBytes,
    totalKB: Math.round(totalBytes / 1024),
    percentOfLimit: Math.round((totalBytes / limitBytes) * 1000) / 10,
    breakdown,
    keys: cashpilotKeys,
    isNearLimit: totalBytes > limitBytes * 0.9
  };
}

/**
 * Clean up old data based on retention policy.
 * @returns {object} Cleanup summary
 */
export function cleanupOldData() {
  const summary = { alertsRemoved: 0, notificationsRemoved: 0 };
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Clean alerts
  try {
    const alerts = JSON.parse(localStorage.getItem("cashpilot-alerts") || "[]");
    const filtered = alerts.filter((a) => a.createdAt >= sevenDaysAgo);
    summary.alertsRemoved = alerts.length - filtered.length;
    localStorage.setItem("cashpilot-alerts", JSON.stringify(filtered));
  } catch { /* ignore */ }

  // Clean notifications
  try {
    const notifs = JSON.parse(localStorage.getItem("cashpilot-notifications") || "[]");
    const filtered = notifs.filter((n) => n.createdAt >= sevenDaysAgo);
    summary.notificationsRemoved = notifs.length - filtered.length;
    localStorage.setItem("cashpilot-notifications", JSON.stringify(filtered));
  } catch { /* ignore */ }

  return summary;
}

/**
 * Track session metadata.
 */
export function trackSession() {
  try {
    const meta = JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");
    meta.lastOpenedDate = new Date().toISOString();
    meta.sessionCount = (meta.sessionCount || 0) + 1;
    localStorage.setItem(SESSION_KEY, JSON.stringify(meta));
    return meta;
  } catch {
    return {};
  }
}

/**
 * Reset all CashPilot localStorage data.
 * @param {boolean} preserveSettings - Keep user settings
 */
export function resetUserData(preserveSettings = true) {
  const settings = preserveSettings ? localStorage.getItem("cashpilot-student-settings") : null;

  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("cashpilot")) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));

  if (settings) {
    localStorage.setItem("cashpilot-student-settings", settings);
  }
}
