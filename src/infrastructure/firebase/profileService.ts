import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  updateDoc,
  increment
} from "firebase/firestore";
import { db } from "./firebase";

export interface UserProfile {
  uid: string;
  displayName: string;
  displayNameLower: string;
  email: string;
  photoURL?: string;
  defaultCurrency: string;
  locale: string;
  timeZone: string;
  onboardingCompleted: boolean;
  accountStatus: "active";
  createdAt: unknown;
  createdBy: string;
  updatedAt: unknown;
  updatedBy: string;
  version: number;
  schemaVersion: number;
}

export const profileService = {
  /**
   * Fetches user profile from Firestore by UID.
   */
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      return null;
    }
    return docSnap.data() as UserProfile;
  },

  /**
   * Idempotently bootstraps a new user profile on sign-up / first Google login.
   * Ensures existing profiles are never overwritten.
   */
  async createUserProfile(uid: string, email: string, displayName: string, photoURL?: string): Promise<void> {
    if (!uid || !email) {
      throw new Error("Cannot bootstrap user profile without valid UID and email.");
    }

    const docRef = doc(db, "users", uid);

    await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(docRef);

      // If profile already exists, do not overwrite it (Idempotent check)
      if (docSnap.exists()) {
        return;
      }

      const initialProfile: UserProfile = {
        uid,
        displayName: displayName || "FairTab User",
        displayNameLower: (displayName || "FairTab User").toLowerCase(),
        email,
        photoURL: photoURL || "",
        defaultCurrency: "INR", // Default currency
        locale: typeof navigator !== "undefined" ? navigator.language || "en-IN" : "en-IN",
        timeZone: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata" : "Asia/Kolkata",
        onboardingCompleted: false,
        accountStatus: "active",
        createdAt: serverTimestamp(),
        createdBy: uid,
        updatedAt: serverTimestamp(),
        updatedBy: uid,
        version: 1,
        schemaVersion: 1,
      };

      transaction.set(docRef, initialProfile);
    });
  },

  /**
   * Updates only self-service fields on user profiles.
   * Increments version, validates immutable properties client-side.
   */
  async updateUserProfile(uid: string, updates: Partial<Pick<UserProfile, "displayName" | "photoURL" | "defaultCurrency" | "locale" | "timeZone" | "onboardingCompleted">>): Promise<void> {
    const docRef = doc(db, "users", uid);

    // Validate that only approved fields are being sent
    const allowedKeys = [
      "displayName",
      "photoURL",
      "defaultCurrency",
      "locale",
      "timeZone",
      "onboardingCompleted"
    ];

    const keys = Object.keys(updates);
    const forbiddenKeys = keys.filter((k) => !allowedKeys.includes(k));
    if (forbiddenKeys.length > 0) {
      throw new Error(`Profile updates reject forbidden attributes: ${forbiddenKeys.join(", ")}`);
    }

    // Build standard payload matching safety rules
    const updatePayload: Record<string, unknown> = {
      ...updates,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
      version: increment(1) // Increments by exactly one
    };

    if (updates.displayName) {
      updatePayload.displayNameLower = updates.displayName.toLowerCase();
    }

    await updateDoc(docRef, updatePayload);
  }
};
