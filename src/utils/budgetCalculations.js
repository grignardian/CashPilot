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
 * Robustly calculates unspent money across candidate cycle ranges, calendar months, and localStorage recaps.
 * @param {Array} transactions - All user transactions
 * @param {object} settings - User profile settings ({ allowance, savingsGoal })
 * @returns {object} Last month leftover summary
 */
export function getLastMonthLeftover(transactions = [], settings = {}) {
  const now = new Date();

  // Read saved recaps if present
  let recaps = {};
  try {
    recaps = JSON.parse(localStorage.getItem("cashpilot-monthly-recaps") || "{}");
  } catch {
    recaps = {};
  }

  // Determine baseline allowance
  let baseAllowance = Number(settings?.allowance || 0);
  if (!baseAllowance) {
    try {
      const saved = JSON.parse(localStorage.getItem("cashpilot-student-settings") || "{}");
      baseAllowance = Number(saved?.allowance || 0);
    } catch { /* ignore */ }
  }

  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYear = prevMonthDate.getFullYear();
  const prevMonth = prevMonthDate.getMonth();
  const prevMonthKey = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}`;
  const prevMonthName = prevMonthDate.toLocaleDateString("en-IN", { month: "long" });

  const currentYear = now.getFullYear();
  const currentMonthKey = `${currentYear}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Candidate A: 7th-to-6th cycle ending this month (e.g. Aug 7 to Sep 6)
  const cycleAStart = `${prevMonthKey}-07`;
  const cycleAEnd = `${currentMonthKey}-06`;

  // Candidate B: Full previous calendar month (e.g. Aug 1 to Aug 31)
  const calStart = `${prevMonthKey}-01`;
  const calEnd = `${prevMonthKey}-31`;

  // Candidate C: Earlier cycle if current date is early in the month (e.g. Jul 7 to Aug 6)
  const prevPrevMonthDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const prevPrevYear = prevPrevMonthDate.getFullYear();
  const prevPrevMonth = prevPrevMonthDate.getMonth();
  const prevPrevMonthKey = `${prevPrevYear}-${String(prevPrevMonth + 1).padStart(2, "0")}`;
  const cycleCStart = `${prevPrevMonthKey}-07`;
  const cycleCEnd = `${prevMonthKey}-06`;

  const normTxs = (transactions || []).map((tx) => ({
    ...tx,
    dateStr: extractTxDateKey(tx),
    amount: Number(tx?.amount || 0),
    type: String(tx?.type || "expense").toLowerCase()
  }));

  const evaluateRange = (startKey, endKey, monthKey, name) => {
    const expTxs = normTxs.filter(
      (tx) => tx.type === "expense" && tx.dateStr >= startKey && tx.dateStr <= endKey
    );
    const incTxs = normTxs.filter(
      (tx) => tx.type === "income" && tx.dateStr >= startKey && tx.dateStr <= endKey
    );
    const totalSpent = expTxs.reduce((sum, tx) => sum + tx.amount, 0);
    const totalIncome = incTxs.reduce((sum, tx) => sum + tx.amount, 0);

    const recap = recaps[monthKey];
    const allowance = Number(recap?.budget || recap?.allowance || baseAllowance || (totalIncome > 0 ? totalIncome : 0));
    const savingsGoal = Number(recap?.savingsGoal !== undefined ? recap.savingsGoal : (settings?.savingsGoal || 0));

    const unspent = allowance > 0 ? Math.max(0, allowance - totalSpent) : Math.max(0, totalIncome - totalSpent);

    return {
      monthKey,
      monthName: name,
      startKey,
      endKey,
      totalSpent,
      totalIncome,
      allowance,
      savingsGoal,
      leftover: unspent,
      txCount: expTxs.length,
      hasData: expTxs.length > 0 || totalIncome > 0 || (recap && recap.totalSpent > 0)
    };
  };

  const resCycleA = evaluateRange(cycleAStart, cycleAEnd, prevMonthKey, prevMonthName);
  const resCal = evaluateRange(calStart, calEnd, prevMonthKey, prevMonthName);
  const resCycleC = evaluateRange(cycleCStart, cycleCEnd, prevPrevMonthKey, prevPrevMonthDate.toLocaleDateString("en-IN", { month: "long" }));

  // Determine the candidate that best captures the user's logged activity
  let best = resCycleA;
  if (best.txCount === 0 && resCal.txCount > 0) {
    best = resCal;
  } else if (best.txCount === 0 && now.getDate() < 7 && resCycleC.txCount > 0) {
    best = resCycleC;
  } else if (resCal.leftover > 0 && best.leftover === 0 && resCal.txCount > 0) {
    best = resCal;
  }

  // Fallback to explicit savingsAchieved in recap if present
  if (recaps[prevMonthKey]?.savingsAchieved !== undefined && recaps[prevMonthKey].savingsAchieved > 0 && best.leftover === 0) {
    best.leftover = Number(recaps[prevMonthKey].savingsAchieved);
  }

  return best;
}


