import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  limit as firestoreLimit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where
} from "firebase/firestore";
import { db } from "../config";

const transactionsRef = (userId) => collection(db, "users", userId, "transactions");
const summaryRef = (userId) => doc(db, "users", userId, "summary", "aggregates");

function summaryDelta(tx, direction = 1) {
  const amount = Number(tx.amount || 0) * direction;
  if (tx.type === "income") {
    return {
      totalIncome: increment(amount),
      netWorth: increment(amount)
    };
  }
  if (tx.type === "expense") {
    return {
      totalExpenses: increment(amount),
      netWorth: increment(-amount)
    };
  }
  return {};
}

export async function addTransaction(userId, txData) {
  try {
    const txPayload = {
      userId,
      amount: Number(txData.amount || 0),
      type: txData.type || "expense",
      category: txData.category || "Other",
      accountId: txData.accountId || "",
      goalId: txData.goalId || "",
      note: txData.note || "",
      date: serverTimestamp(),
      dateKey: txData.dateKey || txData.date || "",
      createdAt: serverTimestamp()
    };

    return await runTransaction(db, async (transaction) => {
      const newTxRef = doc(transactionsRef(userId));
      transaction.set(newTxRef, txPayload);
      transaction.set(
        summaryRef(userId),
        {
          ...summaryDelta(txPayload),
          lastUpdated: serverTimestamp()
        },
        { merge: true }
      );
      return newTxRef;
    });
  } catch (error) {
    throw error;
  }
}

export function getTransactions(userId, filters = {}, next, error) {
  const constraints = [];
  if (filters.accountId) constraints.push(where("accountId", "==", filters.accountId));
  if (filters.goalId) constraints.push(where("goalId", "==", filters.goalId));
  if (filters.type) constraints.push(where("type", "==", filters.type));
  constraints.push(orderBy("date", "desc"));
  constraints.push(firestoreLimit(filters.limit || 50));

  return onSnapshot(
    query(transactionsRef(userId), ...constraints),
    (snapshot) => next(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))),
    error
  );
}

export async function deleteTransaction(userId, txId) {
  try {
    const txRef = doc(db, "users", userId, "transactions", txId);
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(txRef);
      if (!snapshot.exists()) return;
      const tx = snapshot.data();
      transaction.delete(txRef);
      transaction.set(
        summaryRef(userId),
        {
          ...summaryDelta(tx, -1),
          lastUpdated: serverTimestamp()
        },
        { merge: true }
      );
    });
  } catch (error) {
    throw error;
  }
}

export async function getTransactionById(userId, txId) {
  const snapshot = await getDoc(doc(db, "users", userId, "transactions", txId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function updateTransaction(userId, txId, updates) {
  try {
    const txRef = doc(db, "users", userId, "transactions", txId);
    return await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(txRef);
      if (!snapshot.exists()) throw new Error("Transaction does not exist");
      const oldTx = snapshot.data();
      
      const updatedTx = {
        ...oldTx,
        amount: Number(updates.amount || 0),
        category: updates.category || oldTx.category,
        accountId: updates.accountId !== undefined ? updates.accountId : oldTx.accountId,
        goalId: updates.goalId !== undefined ? updates.goalId : oldTx.goalId,
        note: updates.note !== undefined ? updates.note : oldTx.note,
        dateKey: updates.dateKey || updates.date || oldTx.dateKey,
        type: updates.type || oldTx.type
      };

      transaction.set(txRef, updatedTx);

      // Adjust summary deltas: subtract old, add new
      let netWorthDiff = 0;
      let totalIncomeDiff = 0;
      let totalExpensesDiff = 0;

      // Subtract old
      if (oldTx.type === "income") {
        netWorthDiff -= oldTx.amount;
        totalIncomeDiff -= oldTx.amount;
      } else if (oldTx.type === "expense") {
        netWorthDiff += oldTx.amount;
        totalExpensesDiff -= oldTx.amount;
      }

      // Add new
      if (updatedTx.type === "income") {
        netWorthDiff += updatedTx.amount;
        totalIncomeDiff += updatedTx.amount;
      } else if (updatedTx.type === "expense") {
        netWorthDiff -= updatedTx.amount;
        totalExpensesDiff += updatedTx.amount;
      }

      const summaryUpdates = {};
      if (netWorthDiff !== 0) summaryUpdates.netWorth = increment(netWorthDiff);
      if (totalIncomeDiff !== 0) summaryUpdates.totalIncome = increment(totalIncomeDiff);
      if (totalExpensesDiff !== 0) summaryUpdates.totalExpenses = increment(totalExpensesDiff);

      if (Object.keys(summaryUpdates).length > 0) {
        transaction.set(
          summaryRef(userId),
          {
            ...summaryUpdates,
            lastUpdated: serverTimestamp()
          },
          { merge: true }
        );
      }
    });
  } catch (error) {
    throw error;
  }
}
