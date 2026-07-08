/**
 * Category Analytics Utility
 * Trend analysis, insights, and anomaly detection by spending category.
 */

const CATEGORIES = ["Food", "Transport", "Books", "Hangout", "Other"];

/**
 * Generate category breakdown for a given set of expenses.
 * @param {Array} expenses - Filtered expense transactions
 * @param {string} timeframe - 'week' | 'month' | 'all'
 * @returns {Array} Category breakdown sorted by total spent
 */
export function generateCategoryTrends(expenses, timeframe = "month") {
  const now = new Date();
  let filtered = expenses.filter((tx) => tx.type === "expense");

  if (timeframe === "week") {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekKey = weekAgo.toISOString().slice(0, 10);
    filtered = filtered.filter((tx) => (tx.dateKey || "") >= weekKey);
  } else if (timeframe === "month") {
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    filtered = filtered.filter((tx) => (tx.dateKey || "").startsWith(monthKey));
  }

  const totalSpent = filtered.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  const breakdown = CATEGORIES.map((category) => {
    const categoryExpenses = filtered.filter((tx) => tx.category === category);
    const categoryTotal = categoryExpenses.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    return {
      category,
      totalSpent: categoryTotal,
      percentOfTotal: totalSpent > 0 ? Math.round((categoryTotal / totalSpent) * 1000) / 10 : 0,
      transactionCount: categoryExpenses.length
    };
  });

  return breakdown.sort((a, b) => b.totalSpent - a.totalSpent);
}

/**
 * Generate weekly time series data for category spending.
 * @param {Array} expenses - All expense transactions
 * @param {number} weeks - Number of weeks to include (default 4)
 * @returns {Array} Weekly breakdown
 */
export function generateCategoryTimeSeries(expenses, weeks = 4) {
  const now = new Date();
  const series = [];

  for (let i = 0; i < weeks; i++) {
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - (i * 7));
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);

    const startKey = weekStart.toISOString().slice(0, 10);
    const endKey = weekEnd.toISOString().slice(0, 10);

    const weekExpenses = expenses.filter(
      (tx) => tx.type === "expense" && tx.dateKey >= startKey && tx.dateKey <= endKey
    );

    const weekData = {
      weekLabel: `${weekStart.getDate()} ${weekStart.toLocaleDateString("en-IN", { month: "short" })} - ${weekEnd.getDate()} ${weekEnd.toLocaleDateString("en-IN", { month: "short" })}`,
      startDate: startKey,
      endDate: endKey,
      total: 0
    };

    CATEGORIES.forEach((cat) => {
      const catTotal = weekExpenses
        .filter((tx) => tx.category === cat)
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      weekData[cat] = catTotal;
      weekData.total += catTotal;
    });

    series.unshift(weekData);
  }

  return series;
}

/**
 * Generate insights for a specific category.
 * @param {Array} expenses - All transactions
 * @param {string} category - Category name
 * @param {number} totalDays - Days in current month
 * @param {number} daysRemaining - Days left
 * @returns {object} Insights for the category
 */
export function generateCategoryInsights(expenses, category, totalDays, daysRemaining) {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const daysPassed = totalDays - daysRemaining;

  // Current month
  const currentMonthExpenses = expenses.filter(
    (tx) => tx.type === "expense" && tx.category === category && (tx.dateKey || "").startsWith(currentMonthKey)
  );
  const currentTotal = currentMonthExpenses.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  // Previous month
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
  const prevMonthExpenses = expenses.filter(
    (tx) => tx.type === "expense" && tx.category === category && (tx.dateKey || "").startsWith(prevMonthKey)
  );
  const prevTotal = prevMonthExpenses.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  const dailyAverage = daysPassed > 0 ? currentTotal / daysPassed : 0;
  const projectedTotal = Math.round(dailyAverage * totalDays);
  const changeFromPrev = prevTotal > 0
    ? Math.round(((currentTotal - prevTotal) / prevTotal) * 100)
    : currentTotal > 0 ? 100 : 0;

  let trend = "stable";
  if (changeFromPrev > 15) trend = "up";
  if (changeFromPrev < -15) trend = "down";

  let recommendation = "";
  if (trend === "up" && changeFromPrev > 50) {
    recommendation = `${category} spending is up ${changeFromPrev}% from last month. Consider reviewing.`;
  } else if (trend === "down") {
    recommendation = `${category} spending is down—great control this month.`;
  } else {
    recommendation = `${category} spending is steady and on track.`;
  }

  return {
    category,
    stats: {
      currentTotal,
      prevTotal,
      dailyAverage: Math.round(dailyAverage),
      projectedTotal,
      transactionCount: currentMonthExpenses.length
    },
    trend,
    changeFromPrev,
    recommendation
  };
}

/**
 * Detect anomalous expenses (outliers above 2x category average).
 * @param {Array} expenses - All transactions
 * @param {string} category - Category to check
 * @returns {Array} Anomalous expenses
 */
export function detectAnomalies(expenses, category) {
  const categoryExpenses = expenses.filter(
    (tx) => tx.type === "expense" && tx.category === category
  );

  if (categoryExpenses.length < 3) return [];

  const amounts = categoryExpenses.map((tx) => Number(tx.amount || 0));
  const average = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const threshold = average * 2;

  return categoryExpenses
    .filter((tx) => Number(tx.amount || 0) > threshold)
    .map((tx) => ({
      expenseId: tx.id,
      name: tx.note || tx.category,
      amount: Number(tx.amount || 0),
      expectedRange: `₹${Math.round(average * 0.5)} - ₹${Math.round(average * 1.5)}`,
      reason: `Amount is ${Math.round((Number(tx.amount) / average) * 100)}% of category average`
    }));
}

/**
 * Get all category insights at once.
 * @param {Array} expenses - All transactions
 * @param {number} totalDays - Days in month
 * @param {number} daysRemaining - Days remaining
 * @returns {Array} All category insights sorted by spend
 */
export function getAllCategoryInsights(expenses, totalDays, daysRemaining) {
  return CATEGORIES
    .map((cat) => generateCategoryInsights(expenses, cat, totalDays, daysRemaining))
    .sort((a, b) => b.stats.currentTotal - a.stats.currentTotal);
}
