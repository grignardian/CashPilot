import { useMemo } from "react";
import {
  calculateBudgetMetrics,
  getMonthContext,
  predictMonthlySpending,
  sumExpensesForDate,
  sumExpensesForMonth
} from "../utils/budgetCalculations";

/**
 * Hook that computes real-time budget metrics from transactions and settings.
 * Recalculates whenever transactions or settings change.
 *
 * @param {Array} transactions - All user transactions
 * @param {object} settings - { allowance, savingsGoal }
 * @returns {object} Budget metrics, projections, and context
 */
export function useBudgetMetrics(transactions, settings) {
  return useMemo(() => {
    const { allowance = 0, savingsGoal = 0 } = settings || {};
    const ctx = getMonthContext();
    const todayKey = `${ctx.year}-${String(ctx.month + 1).padStart(2, "0")}-${String(ctx.currentDay).padStart(2, "0")}`;

    const monthSpent = sumExpensesForMonth(transactions, ctx.monthKey);
    const todaySpent = sumExpensesForDate(transactions, todayKey);

    const metrics = calculateBudgetMetrics(
      allowance,
      savingsGoal,
      monthSpent,
      ctx.currentDay,
      ctx.daysRemaining
    );

    const projection = predictMonthlySpending(
      ctx.currentDay,
      monthSpent,
      ctx.totalDays,
      allowance,
      savingsGoal
    );

    return {
      ...metrics,
      todaySpent,
      monthSpent,
      projection,
      context: ctx
    };
  }, [transactions, settings]);
}
