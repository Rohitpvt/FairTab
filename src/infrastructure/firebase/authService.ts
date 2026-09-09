import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  sendEmailVerification as firebaseSendEmailVerification,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "firebase/auth";
import type { User, UserCredential } from "firebase/auth";
import { buildPublicAppLink } from "../../utils/urlHelper";
import { auth } from "./firebase";

async function applyPersistence(rememberDevice?: boolean) {
  if (rememberDevice !== undefined) {
    await setPersistence(auth, rememberDevice ? browserLocalPersistence : browserSessionPersistence);
  }
}

/**
 * Translates Firebase authentication error codes to friendly display messages.
 */
export const mapAuthError = (code: string): string => {
  switch (code) {
    case "auth/invalid-email":
      return "The email address is not formatted correctly.";
    case "auth/user-disabled":
      return "This account has been disabled by an administrator.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/email-already-in-use":
      return "This email is already in use by another account.";
    case "auth/weak-password":
      return "Password is too weak. It must be at least 6 characters.";
    case "auth/popup-closed-by-user":
      return "Google sign-in popup was closed before completing the sign-in.";
    case "auth/too-many-requests":
      return "Access to this account has been temporarily disabled due to many failed login attempts.";
    case "auth/network-request-failed":
      return "A network error occurred. Please check your internet connection and try again.";
    default:
      return "An unexpected authentication error occurred. Please try again.";
  }
};

function isFirebaseError(err: unknown): err is { code: string; message?: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as Record<string, unknown>).code === "string"
  );
}

/**
 * Service to encapsulate Firebase Authentication operations.
 */
export const authService = {
  /**
   * Register a user with email and password
   */
  async registerEmail(email: string, password: string, rememberDevice?: boolean): Promise<UserCredential> {
    try {
      await applyPersistence(rememberDevice);
      return await createUserWithEmailAndPassword(auth, email, password);
    } catch (error: unknown) {
      const code = isFirebaseError(error) ? error.code : "unknown";
      throw new Error(mapAuthError(code), { cause: error });
    }
  },

  /**
   * Sign in with email and password
   */
  async loginEmail(email: string, password: string, rememberDevice?: boolean): Promise<UserCredential> {
    try {
      await applyPersistence(rememberDevice);
      return await signInWithEmailAndPassword(auth, email, password);
    } catch (error: unknown) {
      const code = isFirebaseError(error) ? error.code : "unknown";
      throw new Error(mapAuthError(code), { cause: error });
    }
  },

  /**
   * Google OAuth sign-in flow (Supports both Web popup and Mobile Native Google Play Services)
   */
  async signInWithGoogle(rememberDevice?: boolean): Promise<UserCredential> {
    try {
      await applyPersistence(rememberDevice);

      // Check if running inside native Android/iOS Capacitor webview
      const win = typeof window !== "undefined" ? (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { GoogleAuth?: { signIn: () => Promise<{ authentication: { idToken: string } }>; initialize?: () => Promise<void> } } } }) : undefined;
      const isNative = typeof win?.Capacitor?.isNativePlatform === "function" && win.Capacitor.isNativePlatform();

      if (isNative && win?.Capacitor?.Plugins?.GoogleAuth) {
        const GoogleAuth = win.Capacitor.Plugins.GoogleAuth;
        if (typeof GoogleAuth.initialize === "function") {
          try {
            await GoogleAuth.initialize();
          } catch {
            // ignore if already initialized
          }
        }
        const googleUser = await GoogleAuth.signIn();
        const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
        return await signInWithCredential(auth, credential);
      }

      const provider = new GoogleAuthProvider();
      // Configure custom parameters if necessary
      provider.setCustomParameters({ prompt: "select_account" });
      return await signInWithPopup(auth, provider);
    } catch (error: unknown) {
      const code = isFirebaseError(error) ? error.code : "unknown";
      throw new Error(mapAuthError(code), { cause: error });
    }
  },

  /**
   * Send verification email to unverified accounts
   */
  async sendVerificationEmail(user: User): Promise<void> {
    try {
      await firebaseSendEmailVerification(user, {
        url: buildPublicAppLink("/overview"),
      });
    } catch (error: unknown) {
      const code = isFirebaseError(error) ? error.code : "unknown";
      throw new Error(mapAuthError(code), { cause: error });
    }
  },

  /**
   * Dispatch password-reset link to email
   */
  async sendPasswordReset(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email, {
        url: buildPublicAppLink("/auth/login"),
      });
    } catch (error: unknown) {
      const code = isFirebaseError(error) ? error.code : "unknown";
      throw new Error(mapAuthError(code), { cause: error });
    }
  },

  /**
   * Sign out the active session
   */
  async signOut(): Promise<void> {
    try {
      await firebaseSignOut(auth);
    } catch (error: unknown) {
      const code = isFirebaseError(error) ? error.code : "unknown";
      throw new Error(mapAuthError(code), { cause: error });
    }
  }
};
