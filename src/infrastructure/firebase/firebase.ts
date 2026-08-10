import { initializeApp, getApp, getApps } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import type { Auth } from "firebase/auth";
import {
  initializeFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  getFirestore
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator, type Functions } from "firebase/functions";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import type { FirebaseStorage } from "firebase/storage";

const isTest =
  typeof process !== "undefined" &&
  (process.env.NODE_ENV === "test" || process.env.VITEST === "true");

const requiredEnv = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
];

// In non-test environments, strictly validate Firebase configurations
if (!isTest) {
  requiredEnv.forEach((key) => {
    if (!import.meta.env[key]) {
      throw new Error(`Missing required Firebase environment variable: ${key}`);
    }
  });
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "mock-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "mock-auth-domain",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "mock-project-id",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "mock-storage-bucket",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "mock-sender-id",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "mock-app-id",
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let functionsInstance: Functions;
let storage: FirebaseStorage;

const g = typeof window !== "undefined" ? (window as unknown as Record<string, unknown>) : (global as unknown as Record<string, unknown>);
const GLOBAL_DB_KEY = "__FAIRTAB_FIRESTORE_INSTANCE__";
const GLOBAL_EMULATORS_KEY = "__FAIRTAB_EMULATORS_CONNECTED__";

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);

  // Firestore Cache Strategy Selection before initialization
  // untrusted device: memory cache only
  // trusted device: persistent IndexedDB cache with multi-tab support
  const isTrustedDevice = typeof localStorage !== "undefined" && localStorage.getItem("fairtab:active-trusted-device") === "true";

  try {
    if (isTrustedDevice) {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
    } else {
      db = initializeFirestore(app, {
        localCache: memoryLocalCache(),
      });
    }
  } catch (error) {
    console.warn("Firestore custom cache initialization failed, falling back to memory cache", error);
    db = initializeFirestore(app, {
      localCache: memoryLocalCache(),
    });
  }

  g[GLOBAL_DB_KEY] = db;
  auth = getAuth(app);
  functionsInstance = getFunctions(app);
  storage = getStorage(app);

  const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true" || isTest;
  if (useEmulators) {
    if (!g[GLOBAL_EMULATORS_KEY]) {
      connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
      connectFirestoreEmulator(db, "127.0.0.1", 8080);
      connectFunctionsEmulator(functionsInstance, "127.0.0.1", 5001);
      connectStorageEmulator(storage, "127.0.0.1", 9199);
      g[GLOBAL_EMULATORS_KEY] = true;
      console.log("Connected to Firebase Emulators (Auth: 9099, Firestore: 8080, Functions: 5001, Storage: 9199)");
    }
  }
} else {
  app = getApp();
  auth = getAuth(app);
  functionsInstance = getFunctions(app);
  storage = getStorage(app);
  if (g[GLOBAL_DB_KEY]) {
    db = g[GLOBAL_DB_KEY] as Firestore;
  } else {
    try {
      db = getFirestore(app);
    } catch {
      db = initializeFirestore(app, {
        localCache: memoryLocalCache()
      });
    }
    g[GLOBAL_DB_KEY] = db;
  }
}

export { auth, db, functionsInstance as functions, storage };
export default app;
