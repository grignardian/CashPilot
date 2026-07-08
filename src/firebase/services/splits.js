import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { db } from "../config";

const splitsRef = (userId) => collection(db, "users", userId, "splits");

export async function addSplit(userId, data) {
  try {
    const ref = await addDoc(splitsRef(userId), {
      userId,
      expenseId: data.expenseId || "",
      originalAmount: Number(data.originalAmount || 0),
      yourShare: Number(data.yourShare || 0),
      friendShare: Number(data.originalAmount || 0) - Number(data.yourShare || 0),
      friendName: data.friendName || "",
      friendEmail: data.friendEmail || "",
      status: "pending",
      createdDate: data.createdDate || new Date().toISOString().slice(0, 10),
      settledDate: null,
      notes: data.notes || "",
      createdAt: serverTimestamp()
    });
    return ref;
  } catch (error) {
    throw error;
  }
}

export function getSplits(userId, next, error) {
  const q = query(splitsRef(userId), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snapshot) => next(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))),
    error
  );
}

export async function updateSplit(userId, id, data) {
  try {
    await updateDoc(doc(db, "users", userId, "splits", id), {
      ...data
    });
  } catch (error) {
    throw error;
  }
}

export async function deleteSplit(userId, id) {
  try {
    await deleteDoc(doc(db, "users", userId, "splits", id));
  } catch (error) {
    throw error;
  }
}

export async function settleSplit(userId, id) {
  try {
    await updateDoc(doc(db, "users", userId, "splits", id), {
      status: "settled",
      settledDate: new Date().toISOString().slice(0, 10)
    });
  } catch (error) {
    throw error;
  }
}
