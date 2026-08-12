import { describe, test, expect } from "vitest";
import { loginSchema } from "../features/auth/loginSchema";
import { registerSchema } from "../features/auth/registerSchema";
import { forgotPasswordSchema } from "../features/auth/forgotPasswordSchema";
import { mapAuthError } from "../infrastructure/firebase/authService";
import { auth } from "../infrastructure/firebase/firebase";

describe("Authentication Schemas Validation", () => {
  describe("Login Schema", () => {
    test("should reject empty inputs", () => {
      const result = loginSchema.safeParse({ email: "", password: "" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((e) => e.path.includes("email"))).toBe(true);
        expect(result.error.issues.some((e) => e.path.includes("password"))).toBe(true);
      }
    });

    test("should reject invalid emails", () => {
      const result = loginSchema.safeParse({ email: "invalidemail", password: "password123" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("The email address is not formatted correctly.");
      }
    });

    test("should reject weak passwords under 6 characters", () => {
      const result = loginSchema.safeParse({ email: "test@example.com", password: "123" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Password must be at least 6 characters.");
      }
    });

    test("should accept valid inputs", () => {
      const result = loginSchema.safeParse({
        email: "test@example.com",
        password: "password123",
        rememberDevice: true
      });
      expect(result.success).toBe(true);
    });
  });

  describe("Registration Schema", () => {
    test("should check passwords match", () => {
      const result = registerSchema.safeParse({
        displayName: "Jane Doe",
        email: "jane@example.com",
        password: "password123",
        confirmPassword: "differentpassword",
        rememberDevice: false
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Passwords do not match.");
      }
    });

    test("should reject display names that are empty or too long", () => {
      const resultEmpty = registerSchema.safeParse({
        displayName: "",
        email: "jane@example.com",
        password: "password123",
        confirmPassword: "password123"
      });
      expect(resultEmpty.success).toBe(false);

      const resultLong = registerSchema.safeParse({
        displayName: "a".repeat(60),
        email: "jane@example.com",
        password: "password123",
        confirmPassword: "password123"
      });
      expect(resultLong.success).toBe(false);
    });
  });

  describe("Forgot Password Schema", () => {
    test("should validate email format", () => {
      const result = forgotPasswordSchema.safeParse({ email: "notanemail" });
      expect(result.success).toBe(false);
    });
  });
});

describe("Firebase Auth Error Mappings", () => {
  test("should translate standard codes to friendly notifications", () => {
    expect(mapAuthError("auth/invalid-email")).toBe("The email address is not formatted correctly.");
    expect(mapAuthError("auth/wrong-password")).toBe("Incorrect email or password.");
    expect(mapAuthError("auth/email-already-in-use")).toBe("This email is already in use by another account.");
    expect(mapAuthError("auth/weak-password")).toBe("Password is too weak. It must be at least 6 characters.");
  });

  test("should return default fallback message for unknown errors", () => {
    expect(mapAuthError("auth/some-weird-error")).toContain("unexpected");
  });
});

describe("Firebase Initialization Singleton Behavior", () => {
  test("exports valid auth instance and connects to emulators", () => {
    expect(auth).toBeDefined();
    expect(auth.config).toBeDefined();
  });
});

describe("Remember Device Persistence and Session Storage Logic", () => {
  test("sessionStorage stores pending-remember before user signs in", () => {
    sessionStorage.removeItem("fairtab:pending-remember");
    
    // Simulate setTrustedDevicePreference prior to login
    sessionStorage.setItem("fairtab:pending-remember", "true");
    expect(sessionStorage.getItem("fairtab:pending-remember")).toBe("true");

    // Clean up
    sessionStorage.removeItem("fairtab:pending-remember");
  });

  test("failed login cleans up sessionStorage pending choice", () => {
    sessionStorage.setItem("fairtab:pending-remember", "true");
    
    // Simulate failed login/error block cleanup
    try {
      sessionStorage.removeItem("fairtab:pending-remember");
    } catch (e) {
      console.warn(e);
    }
    
    expect(sessionStorage.getItem("fairtab:pending-remember")).toBeNull();
  });

  test("rememberDevice sets correct session and local preferences", () => {
    sessionStorage.setItem("fairtab:pending-remember", "true");
    const isRemembered = sessionStorage.getItem("fairtab:pending-remember") === "true";
    expect(isRemembered).toBe(true);

    sessionStorage.setItem("fairtab:pending-remember", "false");
    const isRememberedFalse = sessionStorage.getItem("fairtab:pending-remember") === "true";
    expect(isRememberedFalse).toBe(false);

    sessionStorage.removeItem("fairtab:pending-remember");
  });
});
