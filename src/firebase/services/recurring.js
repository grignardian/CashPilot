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

const recurringRef = (userId) => collection(db, "users", userId, "recurring");

export async function addRecurring(userId, data) {
  try {
    const ref = await addDoc(recurringRef(userId), {
      userId,
      name: data.name || "",
      amount: Number(data.amount || 0),
      category: data.category || "Other",
      frequency: data.frequency || "monthly",
      nextDueDate: data.nextDueDate || "",
      isActive: data.isActive !== undefined ? data.isActive : true,
      lastLoggedDate: data.lastLoggedDate || null,
      createdAt: serverTimestamp()
    });
    return ref;
  } catch (error) {
    throw error;
  }
}

export function getRecurring(userId, next, error) {
  const q = query(recurringRef(userId), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snapshot) => next(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))),
    error
  );
}

export async function updateRecurring(userId, id, data) {
  try {
    await updateDoc(doc(db, "users", userId, "recurring", id), {
      ...data,
      ...(data.amount !== undefined ? { amount: Number(data.amount) } : {})
    });
  } catch (error) {
    throw error;
  }
}

export async function deleteRecurring(userId, id) {
  try {
    await deleteDoc(doc(db, "users", userId, "recurring", id));
  } catch (error) {
    throw error;
  }
}
