/**
 * Expense Recurrence Utility
 * Detects recurring expenses and manages auto-logging.
 */

const STORAGE_KEY = "cashpilot-recurring-expenses";

/**
 * Get all recurring expenses from localStorage.
 * @returns {Array} Recurring expense objects
 */
export function getRecurringExpenses() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

/**
 * Save recurring expenses to localStorage.
 * @param {Array} items - Recurring expenses array
 */
function saveRecurringExpenses(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/**
 * Add a new recurring expense.
 * @param {object} recurring - Recurring expense data
 * @returns {object} Created recurring expense with ID
 */
export function addRecurringExpense(recurring) {
  const items = getRecurringExpenses();
  const newItem = {
    id: `recurring_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: recurring.name,
    amount: Number(recurring.amount),
    category: recurring.category || "Other",
    frequency: recurring.frequency || "monthly",
    startDate: recurring.startDate || new Date().toISOString().slice(0, 10),
    nextDueDate: recurring.nextDueDate || calculateNextDue(recurring.startDate, recurring.frequency),
    isActive: true,
    lastLoggedDate: null,
    createdAt: new Date().toISOString(),
    ...recurring
  };
  items.push(newItem);
  saveRecurringExpenses(items);
  return newItem;
}

/**
 * Deactivate a recurring expense (soft delete).
 * @param {string} recurringId - ID of the recurring expense
 */
export function deactivateRecurring(recurringId) {
  const items = getRecurringExpenses();
  const index = items.findIndex((item) => item.id === recurringId);
  if (index !== -1) {
    items[index].isActive = false;
    saveRecurringExpenses(items);
  }
}

/**
 * Mark a recurring expense as logged and advance next due date.
 * @param {string} recurringId - ID
 * @param {string} loggedDate - Date it was logged
 * @returns {object|null} Updated recurring expense
 */
export function markRecurringAsLogged(recurringId, loggedDate) {
  const items = getRecurringExpenses();
  const index = items.findIndex((item) => item.id === recurringId);
  if (index === -1) return null;

  items[index].lastLoggedDate = loggedDate;
  items[index].nextDueDate = calculateNextDue(loggedDate, items[index].frequency);
  saveRecurringExpenses(items);
  return items[index];
}

/**
 * Get recurring expenses that are due today or overdue.
 * @returns {Array} Due recurring expenses
 */
export function getDueRecurringExpenses() {
  const today = new Date().toISOString().slice(0, 10);
  return getRecurringExpenses().filter(
    (item) => item.isActive && item.nextDueDate <= today
  );
}

/**
 * Detect potential recurring expenses from transaction history.
 * Looks for expenses with the same name+amount occurring 2+ times.
 * @param {Array} expenses - Transaction list
 * @param {number} confidenceThreshold - Minimum confidence (0-1)
 * @returns {Array} Suggestions for recurring expenses
 */
export function suggestRecurringExpenses(expenses, confidenceThreshold = 0.7) {
  const expenseOnly = expenses.filter((tx) => tx.type === "expense");

  // Group by name+amount signature
  const signatures = {};
  expenseOnly.forEach((tx) => {
    const name = (tx.note || tx.category || "").toLowerCase().trim();
    const amount = Number(tx.amount || 0);
    const key = `${name}__${amount}`;

    if (!signatures[key]) {
      signatures[key] = { name: tx.note || tx.category, amount, category: tx.category, dates: [] };
    }
    signatures[key].dates.push(tx.dateKey || "");
  });

  const suggestions = [];

  Object.values(signatures).forEach((group) => {
    if (group.dates.length < 2) return;

    // Sort dates and calculate intervals
    const sortedDates = group.dates.filter(Boolean).sort();
    if (sortedDates.length < 2) return;

    const intervals = [];
    for (let i = 1; i < sortedDates.length; i++) {
      const diff = daysBetween(sortedDates[i - 1], sortedDates[i]);
      if (diff > 0) intervals.push(diff);
    }

    if (intervals.length === 0) return;

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const frequency = detectFrequency(avgInterval);
    const consistency = calculateConsistency(intervals, avgInterval);
    const confidence = Math.min(1, (group.dates.length / 4) * consistency);

    if (confidence >= confidenceThreshold) {
      suggestions.push({
        name: group.name,
        amount: group.amount,
        category: group.category,
        detectedFrequency: frequency,
        avgIntervalDays: Math.round(avgInterval),
        occurrences: group.dates.length,
        confidence: Math.round(confidence * 100) / 100,
        lastDate: sortedDates[sortedDates.length - 1]
      });
    }
  });

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

// --- Helpers ---

function calculateNextDue(fromDate, frequency) {
  const date = new Date(fromDate || Date.now());

  switch (frequency) {
    case "daily":
      date.setDate(date.getDate() + 1);
      break;
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
    case "biweekly":
      date.setDate(date.getDate() + 14);
      break;
    case "monthly":
    default:
      date.setMonth(date.getMonth() + 1);
      break;
  }

  return date.toISOString().slice(0, 10);
}

function daysBetween(dateA, dateB) {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.round(Math.abs(b - a) / (1000 * 60 * 60 * 24));
}

function detectFrequency(avgDays) {
  if (avgDays <= 2) return "daily";
  if (avgDays <= 9) return "weekly";
  if (avgDays <= 18) return "biweekly";
  return "monthly";
}

function calculateConsistency(intervals, avgInterval) {
  if (intervals.length === 0) return 0;
  const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  // Lower std dev relative to avg = higher consistency
  return Math.max(0, 1 - (stdDev / Math.max(avgInterval, 1)));
}
