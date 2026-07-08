import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../config";

const defaultSettings = {
  allowance: 0,
  savingsGoal: 0
};

export const defaultProfile = {
  name: "CashPilot Student",
  email: "",
  currency: "INR",
  settings: defaultSettings
};

const profileRef = (userId) => doc(db, "users", userId);

function withWriteTimeout(promise) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      globalThis.setTimeout(() => {
        reject(new Error("Firestore did not confirm the save. Deploy firestore.rules, then try again."));
      }, 8000);
    })
  ]);
}

export async function ensureProfile(user, initialSettings = null) {
  const name = user.displayName || "CashPilot Student";
  const ref = profileRef(user.uid);
  const snapshot = await getDoc(ref);
  const existing = snapshot.exists() ? snapshot.data() : {};

  await withWriteTimeout(
    setDoc(
      ref,
      {
        name: existing.name || name,
        email: user.email || "",
        currency: existing.currency || "INR",
        settings: existing.settings || initialSettings || defaultSettings,
        createdAt: existing.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    )
  );
}

export function getProfile(userId, next, error) {
  return onSnapshot(
    profileRef(userId),
    (snapshot) => {
      next(snapshot.exists() ? { ...defaultProfile, ...snapshot.data(), settings: { ...defaultSettings, ...snapshot.data().settings } } : defaultProfile);
    },
    error
  );
}

export async function updateProfile(userId, updates) {
  await withWriteTimeout(
    setDoc(
      profileRef(userId),
      {
        ...updates,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    )
  );
}

export async function updateSettings(userId, settings) {
  await updateProfile(userId, { settings });
}
