import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { auth, db } from "./config";

function requireFirebase() {
  if (!auth || !db) {
    throw new Error("Firebase is not configured. Add your Firebase keys to .env and restart the dev server.");
  }
}

async function createUserProfile(user, name) {
  requireFirebase();
  const batch = writeBatch(db);
  const userRef = doc(db, "users", user.uid);
  const summaryRef = doc(db, "users", user.uid, "summary", "aggregates");

  batch.set(
    userRef,
    {
      name: name || user.displayName || "CashPilot Student",
      email: user.email,
      currency: "INR",
      settings: {
        allowance: 0,
        savingsGoal: 0
      },
      createdAt: serverTimestamp()
    },
    { merge: true }
  );

  batch.set(
    summaryRef,
    {
      netWorth: 0,
      totalIncome: 0,
      totalExpenses: 0,
      totalSaved: 0,
      lastUpdated: serverTimestamp()
    },
    { merge: true }
  );

  await batch.commit();
}

export async function signUpWithEmail(email, password, name) {
  requireFirebase();
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName: name });
  await createUserProfile(credential.user, name);
  return credential.user;
}

export async function signInWithEmail(email, password) {
  requireFirebase();
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function signInWithGoogle() {
  requireFirebase();
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  const userRef = doc(db, "users", credential.user.uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    await createUserProfile(credential.user);
  } else {
    await setDoc(
      userRef,
      {
        name: credential.user.displayName || snapshot.data().name,
        email: credential.user.email,
        currency: snapshot.data().currency || "INR"
      },
      { merge: true }
    );
  }

  return credential.user;
}

export async function signOut() {
  requireFirebase();
  await firebaseSignOut(auth);
}

export function onAuthStateChanged(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return firebaseOnAuthStateChanged(auth, callback);
}
