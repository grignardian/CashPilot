import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addRecurringExpense,
  deactivateRecurring,
  getDueRecurringExpenses,
  getRecurringExpenses,
  markRecurringAsLogged,
  suggestRecurringExpenses
} from "../utils/expenseRecurrence";

/**
 * Hook for managing recurring expenses.
 * Detects patterns, tracks due items, and provides CRUD.
 *
 * @param {Array} transactions - All user transactions
 * @returns {object} Recurring expense state and actions
 */
export function useRecurringExpenses(transactions) {
  const [recurring, setRecurring] = useState(getRecurringExpenses());
  const [dueItems, setDueItems] = useState([]);

  // Check for due items on mount
  useEffect(() => {
    setDueItems(getDueRecurringExpenses());
  }, [recurring]);

  // Detect suggestions from transaction history
  const suggestions = useMemo(() => {
    return suggestRecurringExpenses(transactions, 0.7);
  }, [transactions]);

  const add = useCallback((data) => {
    const item = addRecurringExpense(data);
    setRecurring(getRecurringExpenses());
    return item;
  }, []);

  const remove = useCallback((id) => {
    deactivateRecurring(id);
    setRecurring(getRecurringExpenses());
  }, []);

  const markLogged = useCallback((id, date) => {
    markRecurringAsLogged(id, date);
    setRecurring(getRecurringExpenses());
  }, []);

  const refresh = useCallback(() => {
    setRecurring(getRecurringExpenses());
    setDueItems(getDueRecurringExpenses());
  }, []);

  return {
    recurring: recurring.filter((r) => r.isActive),
    dueItems,
    suggestions,
    add,
    remove,
    markLogged,
    refresh
  };
}
