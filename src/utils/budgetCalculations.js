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
 * Extract a standard YYYY-MM-DD date key from any transaction object or timestamp.
 * @param {object} tx - Transaction object
 * @returns {string} "YYYY-MM-DD" formatted date string or ""
 */
export function extractTxDateKey(tx) {
  if (!tx) return "";
  if (typeof tx.dateKey === "string" && tx.dateKey.length >= 10) {
    return tx.dateKey.slice(0, 10);
  }
  if (typeof tx.date === "string" && tx.date.length >= 10) {
    return tx.date.slice(0, 10);
  }
  if (tx.date && typeof tx.date.toDate === "function") {
    try {
      const d = tx.date.toDate();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    } catch { /* ignore */ }
  }
  if (tx.date && typeof tx.date.seconds === "number") {
    try {
      const d = new Date(tx.date.seconds * 1000);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    } catch { /* ignore */ }
  }
  if (tx.createdAt && typeof tx.createdAt.seconds === "number") {
    try {
      const d = new Date(tx.createdAt.seconds * 1000);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    } catch { /* ignore */ }
  }
  return "";
}

/**
 * Get last month's leftover balance and summary.
 * Accurately computes unspent money from the previous 7th-to-6th cycle (including any extra money added).
 * @param {Array} transactions - All user transactions
 * @param {object} settings - User profile settings ({ allowance, savingsGoal })
 * @returns {object} Last month leftover summary
 */
export function getLastMonthLeftover(transactions = [], settings = {}) {
  const currentCtx = getMonthContext();
  const currentStartDate = new Date(currentCtx.startDateKey);
  const prevCycleRef = new Date(currentStartDate.getTime() - 24 * 60 * 60 * 1000);
  const prevCtx = getMonthContext(prevCycleRef);

  // Read saved recaps if present
  let recaps = {};
  try {
    recaps = JSON.parse(localStorage.getItem("cashpilot-monthly-recaps") || "{}");
  } catch {
    recaps = {};
  }

  // Baseline monthly allowance
  const recap = recaps[prevCtx.monthKey];
  let baseAllowance = Number(recap?.budget || settings?.allowance || 0);
  if (!baseAllowance) {
    try {
      const saved = JSON.parse(localStorage.getItem("cashpilot-student-settings") || "{}");
      baseAllowance = Number(saved?.allowance || 0);
    } catch { /* ignore */ }
  }

  const normTxs = (transactions || []).map((tx) => ({
    ...tx,
    dateStr: extractTxDateKey(tx),
    amount: Number(tx?.amount || 0),
    type: String(tx?.type || "expense").toLowerCase()
  }));

  // Primary: 7th-to-6th cycle
  const cycleExpenses = normTxs.filter(
    (tx) => tx.type === "expense" && tx.dateStr >= prevCtx.startDateKey && tx.dateStr <= prevCtx.endDateKey
  );

  const cycleIncomes = normTxs.filter(
    (tx) => tx.type === "income" &&
      tx.dateStr >= prevCtx.startDateKey &&
      tx.dateStr <= prevCtx.endDateKey &&
      !String(tx.note || "").toLowerCase().includes("rollover")
  );

  const totalSpent = cycleExpenses.reduce((sum, tx) => sum + tx.amount, 0);
  const extraIncome = cycleIncomes.reduce((sum, tx) => sum + tx.amount, 0);

  // Total budget available in the previous cycle is base allowance + any extra income added
  const totalBudget = baseAllowance + extraIncome;
  const savingsGoal = Number(recap?.savingsGoal !== undefined ? recap.savingsGoal : (settings?.savingsGoal || 0));
  const leftover = Math.max(0, totalBudget - totalSpent);

  const monthName = new Date(prevCtx.startDateKey).toLocaleDateString("en-IN", { month: "long" });

  // If user has cycle data, return the cycle result
  if (cycleExpenses.length > 0 || extraIncome > 0 || totalBudget > 0) {
    return {
      monthKey: prevCtx.monthKey,
      monthName,
      startDateKey: prevCtx.startDateKey,
      endDateKey: prevCtx.endDateKey,
      totalSpent,
      totalIncome: extraIncome,
      allowance: totalBudget,
      savingsGoal,
      leftover,
      txCount: cycleExpenses.length,
      hasData: cycleExpenses.length > 0 || extraIncome > 0
    };
  }

  // Fallback for users strictly tracking calendar months (1st to last day)
  const now = new Date();
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const calMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const calExpenses = normTxs.filter((tx) => tx.type === "expense" && tx.dateStr.startsWith(calMonthKey));
  const calIncomes = normTxs.filter((tx) => tx.type === "income" && tx.dateStr.startsWith(calMonthKey) && !String(tx.note || "").toLowerCase().includes("rollover"));
  const calSpent = calExpenses.reduce((sum, tx) => sum + tx.amount, 0);
  const calExtra = calIncomes.reduce((sum, tx) => sum + tx.amount, 0);
  const calBudget = baseAllowance + calExtra;

  return {
    monthKey: calMonthKey,
    monthName: prevMonthDate.toLocaleDateString("en-IN", { month: "long" }),
    startDateKey: `${calMonthKey}-01`,
    endDateKey: `${calMonthKey}-31`,
    totalSpent: calSpent,
    totalIncome: calExtra,
    allowance: calBudget,
    savingsGoal,
    leftover: Math.max(0, calBudget - calSpent),
    txCount: calExpenses.length,
    hasData: calExpenses.length > 0 || calExtra > 0
  };
}


