import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "./AuthContext";
import { createAccount, deleteAccount as deleteAccountDoc, getAccounts, updateAccount as updateAccountDoc } from "../firebase/services/accounts";
import { createGoal, deleteGoal as deleteGoalDoc, getGoals, updateGoal as updateGoalDoc } from "../firebase/services/goals";
import { defaultProfile, ensureProfile, getProfile, updateProfile as updateProfileDoc, updateSettings as updateSettingsDoc } from "../firebase/services/profile";
import { addTransaction as addTransactionDoc, deleteTransaction as deleteTransactionDoc, getTransactions, updateTransaction as updateTransactionDoc } from "../firebase/services/transactions";
import { addRecurring as addRecurringDoc, deleteRecurring as deleteRecurringDoc, getRecurring, updateRecurring as updateRecurringDoc } from "../firebase/services/recurring";
import { addSplit as addSplitDoc, deleteSplit as deleteSplitDoc, getSplits, settleSplit as settleSplitDoc, unsettleSplit as unsettleSplitDoc } from "../firebase/services/splits";
import { getSummary } from "../firebase/services/summary";
import { friendlyError } from "../firebase/errors";
import { cleanupOldData, trackSession } from "../utils/dataManagement";

export const DataContext = createContext(null);

const defaultSummary = {
  netWorth: 0,
  totalIncome: 0,
  totalExpenses: 0,
  totalSaved: 0
};

function getSavedSettings() {
  try {
    return JSON.parse(window.localStorage.getItem("cashpilot-student-settings") || "null");
  } catch {
    return null;
  }
}

export function DataProvider({ children }) {
  const { user } = useContext(AuthContext);
  const [accounts, setAccounts] = useState([]);
  const [goals, setGoals] = useState([]);
  const [profile, setProfile] = useState(defaultProfile);
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(defaultSummary);
  const [recurring, setRecurring] = useState([]);
  const [splits, setSplits] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState("");

  // Session tracking and data cleanup on mount
  useEffect(() => {
    trackSession();
    cleanupOldData();
  }, []);

  useEffect(() => {
    if (!user) {
      setAccounts([]);
      setGoals([]);
      setProfile(defaultProfile);
      setTransactions([]);
      setSummary(defaultSummary);
      setRecurring([]);
      setSplits([]);
      setLoadingData(false);
      return undefined;
    }

    setLoadingData(true);
    setError("");
    const savedSettings = getSavedSettings();
    ensureProfile(user, savedSettings).catch((err) => {
      setError(friendlyError(err));
      setLoadingData(false);
    });

    const handleError = (err) => {
      setError(friendlyError(err));
      setLoadingData(false);
    };

    const unsubscribers = [
      getProfile(user.uid, setProfile, handleError),
      getAccounts(user.uid, setAccounts, handleError),
      getGoals(user.uid, setGoals, handleError),
      getSummary(user.uid, setSummary, handleError),
      getRecurring(user.uid, setRecurring, handleError),
      getSplits(user.uid, setSplits, handleError),
      getTransactions(user.uid, { limit: 100 }, (items) => {
        setTransactions(items);
        setLoadingData(false);
      }, handleError)
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe?.());
  }, [user]);

  const withUser = async (callback) => {
    if (!user) throw new Error("Please sign in first.");
    setError("");
    try {
      return await callback(user.uid);
    } catch (err) {
      const message = friendlyError(err);
      setError(message);
      throw new Error(message);
    }
  };

  const value = useMemo(
    () => ({
      accounts,
      goals,
      profile,
      summary,
      transactions,
      recurring,
      splits,
      loadingData,
      error,
      addAccount: (accountData) => withUser((userId) => createAccount(userId, accountData)),
      updateAccount: (accountId, updates) => withUser((userId) => updateAccountDoc(userId, accountId, updates)),
      deleteAccount: (accountId) => withUser((userId) => deleteAccountDoc(userId, accountId)),
      addGoal: (goalData) => withUser((userId) => createGoal(userId, goalData)),
      updateGoal: (goalId, updates) => withUser((userId) => updateGoalDoc(userId, goalId, updates)),
      deleteGoal: (goalId) => withUser((userId) => deleteGoalDoc(userId, goalId)),
      updateProfile: (updates) => withUser((userId) => updateProfileDoc(userId, updates)),
      updateSettings: (settings) => withUser((userId) => updateSettingsDoc(userId, settings)),
      addTransaction: (txData) => withUser((userId) => addTransactionDoc(userId, txData)),
      updateTransaction: (txId, updates) => withUser((userId) => updateTransactionDoc(userId, txId, updates)),
      deleteTransaction: (txId) => withUser((userId) => deleteTransactionDoc(userId, txId)),
      addRecurring: (data) => withUser((userId) => addRecurringDoc(userId, data)),
      updateRecurring: (id, data) => withUser((userId) => updateRecurringDoc(userId, id, data)),
      deleteRecurring: (id) => withUser((userId) => deleteRecurringDoc(userId, id)),
      addSplit: (data) => withUser((userId) => addSplitDoc(userId, data)),
      settleSplit: (id) => withUser((userId) => settleSplitDoc(userId, id)),
      unsettleSplit: (id) => withUser((userId) => unsettleSplitDoc(userId, id)),
      deleteSplit: (id) => withUser((userId) => deleteSplitDoc(userId, id)),
      clearAllUserData: () => withUser(async (userId) => {
        for (const tx of transactions) {
          await deleteTransactionDoc(userId, tx.id);
        }
        for (const acc of accounts) {
          await deleteAccountDoc(userId, acc.id);
        }
        for (const g of goals) {
          await deleteGoalDoc(userId, g.id);
        }
        for (const s of splits) {
          await deleteSplitDoc(userId, s.id);
        }
        for (const r of recurring) {
          await deleteRecurringDoc(userId, r.id);
        }
        await updateProfileDoc(userId, {
          name: "CashPilot Student",
          settings: {
            allowance: 0,
            savingsGoal: 0
          }
        });
      })
    }),
    [accounts, goals, profile, summary, transactions, recurring, splits, loadingData, error, user]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
