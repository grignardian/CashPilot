/**
 * Budget Calculations Utility
 * Core math for safe daily spend, projections, and budget health.
 */

/**
 * Get the number of days in a given month/year.
 */
function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Calculate all budget metrics for the current period.
 * @param {number} monthlyAllowance - Total monthly budget
 * @param {number} savingsGoal - Monthly savings target
 * @param {number} totalSpent - Amount spent so far this month
 * @param {number} daysPassed - Days elapsed in current month (1-indexed)
 * @param {number} daysRemaining - Days left in current month
 * @returns {object} Budget metrics
 */
export function calculateBudgetMetrics(monthlyAllowance, savingsGoal, totalSpent, daysPassed, daysRemaining) {
  const spendableBudget = Math.max(0, monthlyAllowance - savingsGoal);
  const remainingBudget = spendableBudget - totalSpent;
  const safeDaily = daysRemaining > 0 ? Math.max(0, remainingBudget / daysRemaining) : 0;
  const onTrackPercentage = spendableBudget > 0
    ? Math.min(100, Math.max(0, ((spendableBudget - totalSpent) / spendableBudget) * 100))
    : 0;
  const isOverBudget = totalSpent > spendableBudget;
  const overageAmount = isOverBudget ? totalSpent - spendableBudget : 0;

  return {
    safeDaily: Math.round(safeDaily * 100) / 100,
    remainingBudget,
    spendableBudget,
    daysRemaining,
    daysPassed,
    onTrackPercentage: Math.round(onTrackPercentage * 10) / 10,
    isOverBudget,
    overageAmount,
    dailyAverage: daysPassed > 0 ? Math.round((totalSpent / daysPassed) * 100) / 100 : 0
  };
}

/**
 * Predict total monthly spending based on current pace.
 * @param {number} currentDay - Current day of month (1-indexed)
 * @param {number} currentSpent - Total spent so far
 * @param {number} totalDays - Total days in month
 * @param {number} budget - Monthly budget
 * @param {number} savingsGoal - Savings target
 * @returns {object} Projection data
 */
export function predictMonthlySpending(currentDay, currentSpent, totalDays, budget, savingsGoal) {
  if (currentDay <= 0) {
    return { projectedSpend: 0, willExceed: false, projectedSavings: budget - savingsGoal };
  }

  const dailyRate = currentSpent / currentDay;
  const projectedSpend = Math.round(dailyRate * totalDays);
  const available = budget - savingsGoal;
  const willExceed = projectedSpend > available;
  const projectedSavings = Math.max(0, budget - projectedSpend);

  return {
    projectedSpend,
    willExceed,
    projectedSavings,
    dailyRate: Math.round(dailyRate * 100) / 100,
    daysUntilBudgetExhausted: dailyRate > 0 ? Math.max(0, Math.floor((available - currentSpent) / dailyRate)) : Infinity
  };
}

/**
 * Get current month context (days passed, remaining, etc).
 * @param {Date} [now] - Optional date override for testing
 * @returns {object} Month context
 */
export function getMonthContext(now = new Date()) {
  const d = new Date(now);
  let startDate, endDate;
  
  if (d.getDate() >= 7) {
    startDate = new Date(d.getFullYear(), d.getMonth(), 7);
    endDate = new Date(d.getFullYear(), d.getMonth() + 1, 6);
  } else {
    startDate = new Date(d.getFullYear(), d.getMonth() - 1, 7);
    endDate = new Date(d.getFullYear(), d.getMonth(), 6);
  }

  const formatDate = (date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  const startDateKey = formatDate(startDate);
  const endDateKey = formatDate(endDate);
  
  const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const daysPassed = Math.max(1, Math.min(totalDays, Math.round((d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1));
  const daysRemaining = Math.max(1, Math.min(totalDays, Math.round((endDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)) + 1));

  const year = startDate.getFullYear();
  const month = startDate.getMonth();

  return {
    year,
    month,
    totalDays,
    currentDay: d.getDate(),
    daysPassed,
    daysRemaining,
    startDateKey,
    endDateKey,
    monthKey: `${year}-${String(month + 1).padStart(2, "0")}`
  };
}

/**
 * Sum expenses for a given month from a transaction list.
 * @param {Array} transactions - Array of transaction objects
 * @param {string} monthKey - "YYYY-MM" format
 * @returns {number} Total spent
 */
export function sumExpensesForMonth(transactions, monthKey) {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  
  const startDate = new Date(year, month, 7);
  const endDate = new Date(year, month + 1, 6);
  
  const formatDate = (date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };
  
  const startKey = formatDate(startDate);
  const endKey = formatDate(endDate);

  return transactions
    .filter((tx) => tx.type === "expense" && tx.dateKey >= startKey && tx.dateKey <= endKey)
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
}

/**
 * Sum expenses for a specific date.
 * @param {Array} transactions - Array of transaction objects
 * @param {string} dateKey - "YYYY-MM-DD" format
 * @returns {number} Total spent on that date
 */
export function sumExpensesForDate(transactions, dateKey) {
  return transactions
    .filter((tx) => tx.type === "expense" && tx.dateKey === dateKey)
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
}

/**
 * Get past cycles with allowance, spend, unspent leftover, and rollover status.
 * @param {Array} transactions - All user transactions
 * @param {object} settings - Profile settings ({ allowance, savingsGoal })
 * @param {number} count - Number of past cycles to calculate (default: 6)
 * @returns {Array<object>} Past cycle summaries
 */
export function getPastCyclesSummaries(transactions = [], settings = {}, count = 6) {
  const currentCtx = getMonthContext();
  const pastCycles = [];
  const recaps = (() => {
    try {
      return JSON.parse(localStorage.getItem("cashpilot-monthly-recaps") || "{}");
    } catch {
      return {};
    }
  })();

  // Start with immediate previous cycle (1 cycle back)
  let refDate = new Date(new Date(currentCtx.startDateKey).getTime() - 24 * 60 * 60 * 1000);

  for (let i = 0; i < count; i++) {
    const ctx = getMonthContext(refDate);
    const recap = recaps[ctx.monthKey];

    const cycleExpenses = transactions.filter(
      (tx) => tx.type === "expense" && tx.dateKey >= ctx.startDateKey && tx.dateKey <= ctx.endDateKey
    );
    const cycleIncomes = transactions.filter(
      (tx) => tx.type === "income" && tx.dateKey >= ctx.startDateKey && tx.dateKey <= ctx.endDateKey
    );

    const totalSpent = cycleExpenses.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const totalIncome = cycleIncomes.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    const allowance = recap?.budget || Number(settings?.allowance || 0);
    const savingsGoal = recap?.savingsGoal !== undefined ? recap.savingsGoal : Number(settings?.savingsGoal || 0);

    const spendable = Math.max(0, allowance - savingsGoal);
    const unspent = allowance - totalSpent;
    const spendableLeftover = Math.max(0, spendable - totalSpent);
    const leftover = Math.max(0, unspent);

    // Format dates for display
    const startObj = new Date(ctx.startDateKey);
    const endObj = new Date(ctx.endDateKey);
    const startStr = startObj.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const endStr = endObj.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const cycleLabel = `${startStr} – ${endStr}`;
    const monthName = startObj.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

    const isMarkedRolledOver = localStorage.getItem(`cashpilot-rollover-${ctx.monthKey}`) === "true";
    const hasRolloverTx = transactions.some((tx) => 
      tx.type === "income" &&
      tx.dateKey >= ctx.endDateKey &&
      (
        (tx.note && tx.note.toLowerCase().includes("rollover") && (tx.note.toLowerCase().includes(monthName.toLowerCase()) || tx.note.toLowerCase().includes(ctx.monthKey))) ||
        (i === 0 && tx.note && tx.note.toLowerCase().includes("rollover from previous cycle"))
      )
    );

    const isRolledOver = isMarkedRolledOver || hasRolloverTx;

    pastCycles.push({
      monthKey: ctx.monthKey,
      startDateKey: ctx.startDateKey,
      endDateKey: ctx.endDateKey,
      monthName,
      cycleLabel,
      totalSpent,
      totalIncome,
      allowance,
      savingsGoal,
      spendable,
      spendableLeftover,
      leftover,
      unspent,
      transactionCount: cycleExpenses.length,
      isRolledOver,
      hasData: cycleExpenses.length > 0 || totalSpent > 0 || allowance > 0
    });

    refDate = new Date(new Date(ctx.startDateKey).getTime() - 24 * 60 * 60 * 1000);
  }

  return pastCycles;
}

