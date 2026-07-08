/**
 * Data Export & Import Utility
 * Export/import data as JSON or CSV for backup and portability.
 */

import { getRecurringExpenses } from "./expenseRecurrence";
import { getSplits } from "./splitTracking";
import { getAlerts } from "./alerts";
import { getNotifications } from "./notifications";
import { getMonthlyRecaps } from "./dataManagement";

/**
 * Export all CashPilot data as a JSON object.
 * @param {object} params
 * @param {object} params.profile - User profile
 * @param {Array} params.transactions - All transactions
 * @param {Array} params.accounts - All accounts
 * @param {Array} params.goals - All goals
 * @returns {string} JSON string
 */
export function exportDataAsJSON({ profile, transactions, accounts, goals }) {
  const data = {
    exportDate: new Date().toISOString(),
    appVersion: "1.0.0",
    user: {
      name: profile.name,
      email: profile.email,
      currency: profile.currency,
      budget: profile.settings?.allowance,
      savingsGoal: profile.settings?.savingsGoal
    },
    transactions,
    accounts,
    goals,
    recurringExpenses: getRecurringExpenses(),
    splits: getSplits(),
    alerts: getAlerts(),
    notifications: getNotifications(),
    monthlyRecaps: getMonthlyRecaps()
  };

  return JSON.stringify(data, null, 2);
}

/**
 * Import data from a JSON string.
 * Only imports localStorage-managed data (recurring, splits, alerts, notifications, recaps).
 * Firebase data (transactions, accounts, goals) requires separate sync.
 * @param {string} jsonString - Exported JSON
 * @returns {object} { success, message, itemsImported }
 */
export function importDataFromJSON(jsonString) {
  try {
    const data = JSON.parse(jsonString);

    if (!data.exportDate || !data.appVersion) {
      return { success: false, message: "Invalid CashPilot export file.", itemsImported: 0 };
    }

    let itemsImported = 0;

    if (data.recurringExpenses?.length) {
      localStorage.setItem("cashpilot-recurring-expenses", JSON.stringify(data.recurringExpenses));
      itemsImported += data.recurringExpenses.length;
    }

    if (data.splits?.length) {
      localStorage.setItem("cashpilot-splits", JSON.stringify(data.splits));
      itemsImported += data.splits.length;
    }

    if (data.alerts?.length) {
      localStorage.setItem("cashpilot-alerts", JSON.stringify(data.alerts));
      itemsImported += data.alerts.length;
    }

    if (data.notifications?.length) {
      localStorage.setItem("cashpilot-notifications", JSON.stringify(data.notifications));
      itemsImported += data.notifications.length;
    }

    if (data.monthlyRecaps && Object.keys(data.monthlyRecaps).length) {
      localStorage.setItem("cashpilot-monthly-recaps", JSON.stringify(data.monthlyRecaps));
      itemsImported += Object.keys(data.monthlyRecaps).length;
    }

    return { success: true, message: `Imported ${itemsImported} items successfully.`, itemsImported };
  } catch (err) {
    return { success: false, message: `Import failed: ${err.message}`, itemsImported: 0 };
  }
}

/**
 * Export transactions as CSV.
 * @param {Array} transactions - Transaction objects
 * @returns {string} CSV string
 */
export function exportAsCSV(transactions) {
  const headers = ["Date", "Name", "Category", "Amount", "Type", "Note"];
  const rows = transactions.map((tx) => {
    const name = (tx.note || tx.category || "Expense").split(" · ")[0];
    const note = (tx.note || "").split(" · ").slice(1).join(" · ");
    return [
      tx.dateKey || "",
      escapeCSV(name),
      tx.category || "Other",
      Number(tx.amount || 0),
      tx.type || "expense",
      escapeCSV(note)
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

/**
 * Trigger a file download in the browser.
 * @param {string} content - File content
 * @param {string} filename - Download filename
 * @param {string} mimeType - MIME type
 */
export function downloadFile(content, filename, mimeType = "application/json") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// --- Helpers ---

function escapeCSV(str) {
  if (!str) return "";
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
