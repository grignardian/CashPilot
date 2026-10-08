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
 * Compute the start date and end date for a given cycle year, month, and start day.
 * Handles month-end wrapping cleanly (e.g. 31st of Jan -> 28th of Feb).
 * @param {number} year - Full year (e.g. 2026)
 * @param {number} month - 0-indexed month
 * @param {number} [startDay=7] - Day of month when cycle starts (1-31)
 * @returns {{ startDate: Date, endDate: Date }}
 */
export function getCycleDates(year, month, startDay = 7) {
  const day = Math.max(1, Math.min(31, parseInt(startDay, 10) || 7));
  
  // Start date in target month
  const maxStartDays = new Date(year, month + 1, 0).getDate();
  const clampedStartDay = Math.min(day, maxStartDays);
  const startDate = new Date(year, month, clampedStartDay);
  
  // Next cycle starts in next month
  const maxNextDays = new Date(year, month + 2, 0).getDate();
  const clampedNextStartDay = Math.min(day, maxNextDays);
  const nextStartDate = new Date(year, month + 1, clampedNextStartDay);
  
  // End date is 1 day before the next cycle starts
  const endDate = new Date(nextStartDate.getTime() - 24 * 60 * 60 * 1000);
  
  return { startDate, endDate };
}

/**
 * Get current month context (days passed, remaining, etc) based on user's cycle start day.
 * @param {Date} [now] - Optional date override for testing
 * @param {number} [cycleStartDay=7] - Day of month when the cycle starts
 * @returns {object} Month context
 */
export function getMonthContext(now = new Date(), cycleStartDay = 7) {
  const d = new Date(now);
  const day = Math.max(1, Math.min(31, parseInt(cycleStartDay, 10) || 7));
  
  const currentCandidate = getCycleDates(d.getFullYear(), d.getMonth(), day);
  let startDate, endDate;
  
  if (d.getTime() >= currentCandidate.startDate.getTime()) {
    startDate = currentCandidate.startDate;
    endDate = currentCandidate.endDate;
  } else {
    const prevCandidate = getCycleDates(d.getFullYear(), d.getMonth() - 1, day);
    startDate = prevCandidate.startDate;
    endDate = prevCandidate.endDate;
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
    cycleStartDay: day,
    totalDays,
    currentDay: daysPassed,
    calendarDay: d.getDate(),
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
 * @param {number} [cycleStartDay=7] - Day of month when the cycle starts
 * @returns {number} Total spent
 */
export function sumExpensesForMonth(transactions, monthKey, cycleStartDay = 7) {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  
  const { startDate, endDate } = getCycleDates(year, month, cycleStartDay);
  
  const formatDate = (date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };
  
  const startKey = formatDate(startDate);
  const endKey = formatDate(endDate);

  return (transactions || [])
    .filter((tx) => {
      const dKey = extractTxDateKey(tx);
      const isExpense = String(tx?.type || "expense").toLowerCase() === "expense";
      return isExpense && tx.budgetSource !== "leftover" && !tx.leftoverMonthKey && dKey >= startKey && dKey <= endKey;
    })
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
}

/**
 * Sum expenses for a specific date.
 * @param {Array} transactions - Array of transaction objects
 * @param {string} dateKey - "YYYY-MM-DD" format
 * @returns {number} Total spent on that date
 */
export function sumExpensesForDate(transactions, dateKey) {
  return (transactions || [])
    .filter((tx) => {
      const dKey = extractTxDateKey(tx);
      const isExpense = String(tx?.type || "expense").toLowerCase() === "expense";
      return isExpense && tx.budgetSource !== "leftover" && !tx.leftoverMonthKey && dKey === dateKey;
    })
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
  if (tx.createdAt && typeof tx.createdAt.toDate === "function") {
    try {
      const d = tx.createdAt.toDate();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    } catch { /* ignore */ }
  }
  if (tx.createdAt && typeof tx.createdAt.seconds === "number") {
    try {
      const d = new Date(tx.createdAt.seconds * 1000);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    } catch { /* ignore */ }
  }
  if (tx.date instanceof Date) {
    try {
      return `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, "0")}-${String(tx.date.getDate()).padStart(2, "0")}`;
    } catch { /* ignore */ }
  }
  if (typeof tx.date === "number" && tx.date > 0) {
    try {
      const d = new Date(tx.date > 1e11 ? tx.date : tx.date * 1000);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    } catch { /* ignore */ }
  }
  return "";
}

/**
 * Retrieve saved cycle budget history.
 * @returns {object} Keyed by monthKey "YYYY-MM"
 */
export function getCycleBudgets() {
  try {
    return JSON.parse(localStorage.getItem("cashpilot-cycle-budgets") || "{}");
  } catch {
    return {};
  }
}

/**
 * Save budget targets for a specific monthly cycle.
 * @param {string} monthKey - "YYYY-MM" format
 * @param {number} budget - Monthly allowance
 * @param {number} [savingsGoal=0] - Savings target
 */
export function saveCycleBudget(monthKey, budget, savingsGoal = 0) {
  if (!monthKey) return;
  const budgets = getCycleBudgets();
  budgets[monthKey] = {
    budget: Number(budget || 0),
    savingsGoal: Number(savingsGoal || 0),
    updatedAt: new Date().toISOString()
  };
  try {
    localStorage.setItem("cashpilot-cycle-budgets", JSON.stringify(budgets));
  } catch { /* ignore */ }
}

/**
 * Get last month's leftover balance and summary.
 * Accurately computes unspent money from the previous period based on the user's cycle start day.
 * @param {Array} transactions - All user transactions
 * @param {object} settings - User profile settings ({ allowance, savingsGoal, cycleStartDay })
 * @returns {object} Last month leftover summary
 */
export function getLastMonthLeftover(transactions = [], settings = {}) {
  const cycleStartDay = settings?.cycleStartDay || settings?.budgetStartDay || 7;
  const currentCtx = getMonthContext(new Date(), cycleStartDay);
  const currentStartDate = new Date(currentCtx.startDateKey);
  const prevCycleRef = new Date(currentStartDate.getTime() - 24 * 60 * 60 * 1000);
  const prevCtx = getMonthContext(prevCycleRef, cycleStartDay);

  const cycleBudgets = getCycleBudgets();

  // Read saved recaps if present
  let recaps = {};
  try {
    recaps = JSON.parse(localStorage.getItem("cashpilot-monthly-recaps") || "{}");
  } catch {
    recaps = {};
  }

  // Baseline monthly allowance for previous cycle
  const recap = recaps[prevCtx.monthKey];
  let baseAllowance = 0;

  if (settings?.cycleBudgets?.[prevCtx.monthKey]?.budget !== undefined) {
    baseAllowance = Number(settings.cycleBudgets[prevCtx.monthKey].budget);
  } else if (cycleBudgets[prevCtx.monthKey]?.budget !== undefined) {
    baseAllowance = Number(cycleBudgets[prevCtx.monthKey].budget);
  } else if (recap?.budget !== undefined) {
    baseAllowance = Number(recap.budget);
  } else {
    baseAllowance = Number(settings?.allowance || 0);
  }

  const normTxs = (transactions || []).map((tx) => ({
    ...tx,
    dateStr: extractTxDateKey(tx),
    amount: Number(tx?.amount || 0),
    type: String(tx?.type || "expense").toLowerCase(),
    budgetSource: tx?.budgetSource || "",
    leftoverMonthKey: tx?.leftoverMonthKey || ""
  }));

  const prevPeriodStartKey = prevCtx.startDateKey;
  const prevPeriodEndKey = prevCtx.endDateKey;

  const cycleExpenses = normTxs.filter(
    (tx) => tx.type === "expense" && tx.budgetSource !== "leftover" && !tx.leftoverMonthKey && tx.dateStr >= prevPeriodStartKey && tx.dateStr <= prevPeriodEndKey
  );

  const cycleIncomes = normTxs.filter(
    (tx) => tx.type === "income" &&
      tx.dateStr >= prevPeriodStartKey &&
      tx.dateStr <= prevPeriodEndKey &&
      !String(tx.note || "").toLowerCase().includes("rollover")
  );

  const totalSpent = cycleExpenses.reduce((sum, tx) => sum + tx.amount, 0);
  const extraIncome = cycleIncomes.reduce((sum, tx) => sum + tx.amount, 0);

  // Baseline monthly allowance is the fixed monthly budget
  const totalBudget = baseAllowance;

  const prevSavingsGoal = settings?.cycleBudgets?.[prevCtx.monthKey]?.savingsGoal !== undefined
    ? Number(settings.cycleBudgets[prevCtx.monthKey].savingsGoal)
    : (cycleBudgets[prevCtx.monthKey]?.savingsGoal !== undefined
        ? Number(cycleBudgets[prevCtx.monthKey].savingsGoal)
        : Number(recap?.savingsGoal !== undefined ? recap.savingsGoal : (settings?.savingsGoal || 0)));

  const leftover = Math.max(0, totalBudget - totalSpent);

  const monthName = new Date(prevCtx.startDateKey).toLocaleDateString("en-IN", { month: "long" });

  return {
    monthKey: prevCtx.monthKey,
    monthName,
    startDateKey: prevPeriodStartKey,
    endDateKey: prevPeriodEndKey,
    totalSpent,
    totalIncome: extraIncome,
    allowance: totalBudget,
    savingsGoal: prevSavingsGoal,
    leftover,
    txCount: cycleExpenses.length,
    hasData: cycleExpenses.length > 0 || totalBudget > 0
  };
}

