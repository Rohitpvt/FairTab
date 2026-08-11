/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { onAuthStateChanged, setPersistence, browserLocalPersistence, browserSessionPersistence } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth } from "../../infrastructure/firebase/firebase";
import { authService } from "../../infrastructure/firebase/authService";
import { profileService } from "../../infrastructure/firebase/profileService";
import type { UserProfile } from "../../infrastructure/firebase/profileService";
import { syncManager } from "../../infrastructure/offline/syncManager";

export type AuthStateMachineState =
  | "initializing"
  | "unauthenticated"
  | "authenticated-profile-loading"
  | "email-verification-required"
  | "onboarding-required"
  | "ready"
  | "error";

export interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  authState: AuthStateMachineState;
  error: string | null;
  trustedDevice: boolean;
  setTrustedDevicePreference: (value: boolean, triggerReload?: boolean) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: (clearAll?: boolean) => Promise<void>;
  bootstrapProfile: (user: User, displayName?: string, photoURL?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authState, setAuthState] = useState<AuthStateMachineState>("initializing");
  const [error, setError] = useState<string | null>(null);
  const [trustedDevice, setTrustedDevice] = useState<boolean>(false);

  // Sync trusted-device preference with UI-scoped localStorage key
  const getTrustedKey = (uid: string) => `fairtab:${uid}:trusted-device`;

  const refreshProfile = useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      const p = await profileService.getUserProfile(auth.currentUser.uid);
      if (p) {
        setProfile(p);
        
        // Google authentication uses Firebase verified-email state
        const requireVerification = import.meta.env.VITE_REQUIRE_EMAIL_VERIFICATION !== "false";
        const isVerified = !requireVerification || auth.currentUser.emailVerified || auth.currentUser.providerData.some(p => p.providerId === "google.com");
        
        if (!isVerified) {
          setAuthState("email-verification-required");
        } else if (!p.onboardingCompleted) {
          setAuthState("onboarding-required");
        } else {
          setAuthState("ready");
        }
      }
    } catch (err: unknown) {
      console.error("Failed to refresh user profile:", err);
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj.message || "Failed to load user profile.");
      setAuthState("error");
    }
  }, []);

  const bootstrapProfile = useCallback(async (u: User, displayName?: string, photoURL?: string) => {
    setAuthState("authenticated-profile-loading");
    try {
      await profileService.createUserProfile(u.uid, u.email || "", displayName || u.displayName || "", photoURL || u.photoURL || "");
      await refreshProfile();
    } catch (err: unknown) {
      console.error("Failed to bootstrap user profile:", err);
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj.message || "Failed to create user profile.");
      setAuthState("error");
    }
  }, [refreshProfile]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setProfile(null);
        setAuthState("unauthenticated");
        setTrustedDevice(false);
      } else {
        setUser(u);
        
        // Fetch trusted status for active user
        const isTrusted = localStorage.getItem(getTrustedKey(u.uid)) === "true";
        setTrustedDevice(isTrusted);
        
        // Dynamically set Firebase Auth persistence based on device preference before retrieving
        try {
          await setPersistence(auth, isTrusted ? browserLocalPersistence : browserSessionPersistence);
        } catch (e) {
          console.warn("Failed to set auth persistence:", e);
        }

        setAuthState("authenticated-profile-loading");
        try {
          const p = await profileService.getUserProfile(u.uid);
          if (p) {
            setProfile(p);
            
            const requireVerification = import.meta.env.VITE_REQUIRE_EMAIL_VERIFICATION !== "false";
            const isVerified = !requireVerification || u.emailVerified || u.providerData.some(prov => prov.providerId === "google.com");
            
            if (!isVerified) {
              setAuthState("email-verification-required");
            } else if (!p.onboardingCompleted) {
              setAuthState("onboarding-required");
            } else {
              setAuthState("ready");
            }
          } else {
            // Document doesn't exist yet, trigger idempotent bootstrap
            await bootstrapProfile(u);
          }
        } catch (err: unknown) {
          console.error("Error loading user profile:", err);
          const errorObj = err instanceof Error ? err : new Error(String(err));
          setError(errorObj.message || "An error occurred while loading your profile.");
          setAuthState("error");
        }
      }
    });

    return () => unsubscribe();
  }, [bootstrapProfile, refreshProfile]);

  const setTrustedDevicePreference = useCallback(async (value: boolean, triggerReload = false) => {
    if (!user) return;
    
    const key = getTrustedKey(user.uid);
    if (value) {
      localStorage.setItem(key, "true");
      localStorage.setItem("fairtab:active-trusted-device", "true");
      await setPersistence(auth, browserLocalPersistence);
    } else {
      localStorage.removeItem(key);
      // Scan for any other active trusted devices
      const anyOtherTrusted = Object.keys(localStorage).some(
        (k) => k.startsWith("fairtab:") && k.endsWith(":trusted-device") && localStorage.getItem(k) === "true"
      );
      if (!anyOtherTrusted) {
        localStorage.removeItem("fairtab:active-trusted-device");
      }
      await setPersistence(auth, browserSessionPersistence);
    }
    setTrustedDevice(value);

    if (triggerReload) {
      window.location.reload();
    }
  }, [user]);

  const signOut = useCallback(async (clearAll = false) => {
    const currentUid = user?.uid;
    
    try {
      await authService.signOut();
    } catch (e) {
      console.warn("Auth signout threw error:", e);
    }

    // Sign out clears local cache settings
    setUser(null);
    setProfile(null);
    setAuthState("unauthenticated");
    setTrustedDevice(false);

    if (currentUid) {
      const isTrusted = localStorage.getItem(getTrustedKey(currentUid)) === "true";
      
      // If untrusted or explicitly requested, purge user cache
      if (!isTrusted || clearAll) {
        localStorage.removeItem(getTrustedKey(currentUid));
        
        // Clear all keys starting with UID prefix
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith(`fairtab:${currentUid}:`) || k.startsWith("fairtab:"))) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));

        // Purge Dexie offline databases
        syncManager.purgeUserOfflineData(currentUid);
      }
    }
  }, [user]);

  const contextValue = useMemo(
    () => ({
      user,
      profile,
      authState,
      error,
      trustedDevice,
      setTrustedDevicePreference,
      refreshProfile,
      signOut,
      bootstrapProfile,
    }),
    [user, profile, authState, error, trustedDevice, setTrustedDevicePreference, refreshProfile, signOut, bootstrapProfile]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
