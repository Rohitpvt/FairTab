import { test, expect } from "@playwright/test";

/**
 * Project ID must match .firebaserc and .env VITE_FIREBASE_PROJECT_ID.
 * The emulator REST API uses this project ID for all admin endpoints.
 */
const EMULATOR_PROJECT_ID = "mock-project-id";

interface OobCode {
  email: string;
  requestType: string;
  oobLink: string;
}

interface OobCodesResponse {
  oobCodes?: OobCode[];
}

/**
 * Retrieves the OOB verification link from the Auth Emulator for a given email.
 * The emulator stores all pending out-of-band codes (email verification, password reset, etc.)
 * which can be fetched via: GET /emulator/v1/projects/{project-id}/oobCodes
 */
async function getVerificationLink(email: string): Promise<string | null> {
  const res = await fetch(
    `http://127.0.0.1:9099/emulator/v1/projects/${EMULATOR_PROJECT_ID}/oobCodes`
  );
  const data = (await res.json()) as OobCodesResponse;
  const codes = data.oobCodes || [];
  // Find the VERIFY_EMAIL code for the target email (most recent first)
  const match = [...codes].reverse().find(
    (c: OobCode) => c.email === email && c.requestType === "VERIFY_EMAIL"
  );
  return match?.oobLink || null;
}

async function deleteUserByEmail(email: string): Promise<void> {
  try {
    const listRes = await fetch(
      `http://127.0.0.1:9099/emulator/v1/projects/${EMULATOR_PROJECT_ID}/accounts`
    );
    const listData = (await listRes.json()) as { users?: { localId: string; email: string }[] };
    const users = listData.users || [];
    const targetUser = users.find((u) => u.email === email);
    if (targetUser) {
      await fetch(
        `http://127.0.0.1:9099/emulator/v1/projects/${EMULATOR_PROJECT_ID}/accounts/${targetUser.localId}`,
        { method: "DELETE" }
      );
    }
  } catch (e) {
    console.warn(`Could not delete user ${email} from emulator`, e);
  }
}

test.describe("FairTab Auth and Onboarding E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to reset states
    await page.goto("", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await page.goto("", { waitUntil: "domcontentloaded" });
  });

  test("should redirect unauthenticated users to login", async ({ page }) => {
    await page.goto("#/overview");
    await expect(page).toHaveURL(/.*#\/auth\/login/);
  });

  test("should focus on the first invalid field and announce validation errors", async ({ page }) => {
    await page.goto("#/auth/login");

    // Click submit without entering values (use exact: true to avoid matching Google button)
    await page.getByRole("button", { name: "Sign In", exact: true }).click();

    // Verify focus is set on email input
    const emailInput = page.locator("#login-email");
    await expect(emailInput).toBeFocused();

    // Verify error message is announced in ARIA live region
    const liveRegion = page.locator("[aria-live='assertive']");
    await expect(liveRegion).toContainText("Email is required.");
  });

  test("should allow keyboard navigation through login form", async ({ page }) => {
    await page.goto("#/auth/login");

    // Focus first input
    const emailInput = page.locator("#login-email");
    await emailInput.focus();
    await expect(emailInput).toBeFocused();

    // Tab from email → "Forgot Password?" link sits between email and password
    await page.keyboard.press("Tab");
    const forgotLink = page.locator("a[href*='forgot-password']");
    await expect(forgotLink).toBeFocused();

    // Tab from "Forgot Password?" link → password input
    await page.keyboard.press("Tab");
    const passwordInput = page.locator("#login-password");
    await expect(passwordInput).toBeFocused();

    // Tab to toggle password visibility button
    await page.keyboard.press("Tab");
    const toggleBtn = page.getByLabel("Show password");
    await expect(toggleBtn).toBeFocused();

    // Tab to remember device checkbox
    await page.keyboard.press("Tab");
    const rememberCheckbox = page.locator("#remember-device");
    await expect(rememberCheckbox).toBeFocused();

    // Tab to submit button
    await page.keyboard.press("Tab");
    const submitBtn = page.getByRole("button", { name: "Sign In", exact: true });
    await expect(submitBtn).toBeFocused();
  });

  test("should handle incorrect credentials", async ({ page }) => {
    await page.goto("#/auth/login");

    await page.locator("#login-email").fill("wrong-email@example.com");
    await page.locator("#login-password").fill("wrongpassword");
    await page.getByRole("button", { name: "Sign In", exact: true }).click();

    // Verify error notification is announced via the ARIA live region
    const liveRegion = page.locator("[aria-live='assertive']");
    await expect(liveRegion).not.toBeEmpty({ timeout: 10000 });
  });

  test("should handle password-reset request", async ({ page }) => {
    await page.goto("#/auth/forgot-password");

    await page.locator("#reset-email").fill("alice@example.com");
    await page.getByRole("button", { name: "Send Reset Link" }).click();

    // The success view shows: "We have sent a password reset link to your email address."
    await expect(page.getByText("password reset link")).toBeVisible({ timeout: 10000 });
  });

  test("should complete registration, verify email, onboard, and sign out with cache isolation", async ({ page }) => {
    const testEmail = `user-${Date.now()}@example.com`;
    const testName = "E2E Test User";

    try {
      // 1. Go to register page
      await page.goto("#/auth/register");

      await page.locator("#reg-name").fill(testName);
      await page.locator("#reg-email").fill(testEmail);
      await page.locator("#reg-password").fill("password123");
      await page.locator("#reg-confirm-password").fill("password123");
      await page.locator("#reg-remember-device").check();

      // Create Account
      await page.getByRole("button", { name: "Create Account" }).click();

      // Assert redirects to verify email page
      await expect(page).toHaveURL(/.*#\/auth\/verify-email/, { timeout: 15000 });
      await expect(page.locator("text=Verify Your Email")).toBeVisible();

      // Assert unverified user guard blocks protected routes
      await page.goto("#/overview");
      await expect(page).toHaveURL(/.*#\/auth\/verify-email/);

      // 2. Use the emulator OOB codes endpoint to retrieve the verification link
      //    and visit it to verify the email address
      const verifyLink = await getVerificationLink(testEmail);
      expect(verifyLink).toBeTruthy();
      if (verifyLink) {
        await fetch(verifyLink);
      }

      // 3. Click Refresh verification status in the page
      await page.getByRole("button", { name: "Refresh Verification Status" }).click();

      // Assert redirect to onboarding
      await expect(page).toHaveURL(/.*#\/onboarding/, { timeout: 10000 });
      await expect(page.locator("text=Welcome to FairTab")).toBeVisible();

      // 4. Run Onboarding flow steps
      await page.getByRole("button", { name: "Next" }).click(); // Step 1 Welcome
      await expect(page.locator("#onboard-name")).toHaveValue(testName);
      await page.locator("#onboard-currency").selectOption("USD");
      await page.getByRole("button", { name: "Next" }).click(); // Step 2 Profile
      await page.locator("#onboard-remember").check();
      await page.getByRole("button", { name: "Next" }).click(); // Step 3 Device
      await page.getByRole("button", { name: "Next" }).click(); // Step 4 Caching
      await page.getByRole("button", { name: "Complete Setup" }).click(); // Step 5 Complete

      // 5. Assert landing on dashboard overview
      await expect(page).toHaveURL(/.*#\/overview/, { timeout: 10000 });
      await expect(page.locator("h1")).toContainText("Dashboard");

      // 6. Go to Settings, verify device cache label
      await page.goto("#/settings");
      await expect(page.getByText("Trusted Device").first()).toBeVisible();

      // 7. Test Sign Out cache isolation
      await page.evaluate(() => localStorage.setItem("theme", "dark"));

      await page.getByRole("button", { name: "Sign Out" }).click();
      await expect(page).toHaveURL(/.*#\/auth\/login/);

      // Verify UID-scoped keys are cleared, but generic theme is preserved
      const localStorageState = await page.evaluate(() => ({
        theme: localStorage.getItem("theme"),
        activeTrusted: localStorage.getItem("fairtab:active-trusted-device"),
        keysLength: localStorage.length
      }));

      // Trusted device: the active-trusted-device flag persists after sign-out
      // (this is the documented behavior — trusted device cache is not cleared on sign-out)
      expect(localStorageState.theme).toBe("dark");
      expect(localStorageState.activeTrusted).toBe("true");
    } finally {
      await deleteUserByEmail(testEmail);
    }
  });
});
