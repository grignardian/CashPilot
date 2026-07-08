import { useCallback, useEffect, useState } from "react";
import {
  checkAndGenerateAlerts,
  clearOldAlerts,
  dismissAlert,
  getAlerts,
  getDismissableAlerts
} from "../utils/alerts";
import { useBudgetMetrics } from "./useBudgetMetrics";

/**
 * Hook for managing budget alerts.
 * Checks thresholds on mount and after transaction changes.
 * Re-validates alerts when spending changes (e.g. after deleting a record).
 *
 * @param {Array} transactions - All user transactions
 * @param {object} settings - { allowance, savingsGoal }
 * @returns {object} { alerts, alertCount, hasCritical, dismiss, refresh }
 */
export function useAlerts(transactions, settings) {
  const [activeAlerts, setActiveAlerts] = useState([]);
  const metrics = useBudgetMetrics(transactions, settings);

  // Clean old alerts on mount
  useEffect(() => {
    clearOldAlerts();
  }, []);

  // Re-evaluate alerts when metrics change
  useEffect(() => {
    const { allowance = 0, savingsGoal = 0 } = settings || {};
    const available = allowance - savingsGoal;

    // Generate new alerts if thresholds are breached
    checkAndGenerateAlerts({
      todaySpent: metrics.todaySpent,
      monthSpent: metrics.monthSpent,
      safeDaily: metrics.safeDaily,
      budget: allowance,
      savingsGoal
    });

    // Now validate existing alerts — dismiss ones that are no longer valid
    const current = getDismissableAlerts();
    const stillValid = current.filter((alert) => {
      if (alert.type === "daily") {
        // Daily alert still valid if today's spending still exceeds threshold
        return metrics.safeDaily > 0 && (metrics.todaySpent / metrics.safeDaily) >= 0.75;
      }
      if (alert.type === "monthly") {
        // Monthly alert still valid if monthly spending still exceeds threshold
        return available > 0 && (metrics.monthSpent / available) >= 0.85;
      }
      return true;
    });

    setActiveAlerts(stillValid);
  }, [metrics.todaySpent, metrics.monthSpent, metrics.safeDaily, settings]);

  const dismiss = useCallback((alertId) => {
    dismissAlert(alertId);
    setActiveAlerts(getDismissableAlerts());
  }, []);

  const refresh = useCallback(() => {
    const { allowance = 0, savingsGoal = 0 } = settings || {};
    const available = allowance - savingsGoal;

    const current = getDismissableAlerts();
    const stillValid = current.filter((alert) => {
      if (alert.type === "daily") {
        return metrics.safeDaily > 0 && (metrics.todaySpent / metrics.safeDaily) >= 0.75;
      }
      if (alert.type === "monthly") {
        return available > 0 && (metrics.monthSpent / available) >= 0.85;
      }
      return true;
    });

    setActiveAlerts(stillValid);
  }, [metrics.todaySpent, metrics.monthSpent, metrics.safeDaily, settings]);

  return {
    alerts: activeAlerts,
    alertCount: activeAlerts.length,
    hasCritical: activeAlerts.some((a) => a.severity === "critical"),
    dismiss,
    refresh
  };
}
