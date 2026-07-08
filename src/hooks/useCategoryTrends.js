import { useMemo } from "react";
import {
  generateCategoryTrends,
  generateCategoryTimeSeries,
  getAllCategoryInsights
} from "../utils/categoryAnalytics";
import { getMonthContext } from "../utils/budgetCalculations";

/**
 * Hook for category spending trends and insights.
 * Caches computation; recalculates on transaction changes.
 *
 * @param {Array} transactions - All user transactions
 * @returns {object} { weeklyTrends, monthlyTrends, timeSeries, insights }
 */
export function useCategoryTrends(transactions) {
  return useMemo(() => {
    const ctx = getMonthContext();

    const weeklyTrends = generateCategoryTrends(transactions, "week");
    const monthlyTrends = generateCategoryTrends(transactions, "month");
    const timeSeries = generateCategoryTimeSeries(transactions, 4);
    const insights = getAllCategoryInsights(transactions, ctx.totalDays, ctx.daysRemaining);

    return {
      weeklyTrends,
      monthlyTrends,
      timeSeries,
      insights
    };
  }, [transactions]);
}
