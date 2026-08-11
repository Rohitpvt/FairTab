import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Project ID must match .firebaserc and .env VITE_FIREBASE_PROJECT_ID.
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
 */
async function getVerificationLink(email: string): Promise<string | null> {
  const res = await fetch(
    `http://127.0.0.1:9099/emulator/v1/projects/${EMULATOR_PROJECT_ID}/oobCodes`
  );
  const data = (await res.json()) as OobCodesResponse;
  const codes = data.oobCodes || [];
  const match = [...codes].reverse().find(
    (c: OobCode) => c.email === email && c.requestType === "VERIFY_EMAIL"
  );
  return match?.oobLink || null;
}

/**
 * Deletes a specific user by email from the auth emulator.
 */
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

/**
 * Registers a fresh user, verifies their email via the emulator OOB codes endpoint,
 * completes onboarding, and lands on the dashboard.
 * Returns the unique email address used.
 */
async function ensureSignedIn(page: Page): Promise<string> {
  const uniqueEmail = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

  // Clear localStorage
  await page.goto("", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.goto("", { waitUntil: "domcontentloaded" });

  // Register
  await page.goto("#/auth/register");
  await page.locator("#reg-name").fill("E2E Dashboard User");
  await page.locator("#reg-email").fill(uniqueEmail);
  await page.locator("#reg-password").fill("password123");
  await page.locator("#reg-confirm-password").fill("password123");
  await page.locator("#reg-remember-device").check();
  await page.getByRole("button", { name: "Create Account" }).click();

  // Redirect to verify email page
  await expect(page).toHaveURL(/.*#\/auth\/verify-email/, { timeout: 15000 });

  // Fetch and visit the OOB verification link from the emulator
  const verifyLink = await getVerificationLink(uniqueEmail);
  if (verifyLink) {
    await fetch(verifyLink);
  }

  // Refresh status
  await page.getByRole("button", { name: "Refresh Verification Status" }).click();

  // Stepped onboarding sequence
  await expect(page).toHaveURL(/.*#\/onboarding/, { timeout: 10000 });
  await page.getByRole("button", { name: "Next" }).click(); // Step 1 Welcome
  await page.getByRole("button", { name: "Next" }).click(); // Step 2 Profile
  await page.getByRole("button", { name: "Next" }).click(); // Step 3 Device
  await page.getByRole("button", { name: "Next" }).click(); // Step 4 Caching
  await page.getByRole("button", { name: "Complete Setup" }).click(); // Step 5 Complete

  // Head to overview
  await expect(page).toHaveURL(/.*#\/overview/, { timeout: 10000 });
  return uniqueEmail;
}

test.describe("FairTab E2E Tests", () => {
  test("should redirect to /overview and display dashboard elements", async ({ page }) => {
    const email = await ensureSignedIn(page);
    try {
      await expect(page).toHaveURL(/.*#\/overview/);
      await expect(page.locator("h1")).toContainText("Dashboard");

      const balanceCard = page.locator("text=You are owed").first();
      await expect(balanceCard).toBeVisible();
    } finally {
      await deleteUserByEmail(email);
    }
  });

  test("should toggle sidebar collapsed state on desktop", async ({ page }) => {
    const email = await ensureSignedIn(page);
    try {
      const sidebar = page.locator("aside");
      await expect(sidebar).toHaveClass(/w-\[256px\]/);

      const collapseBtn = page.getByLabel("Collapse sidebar");
      await collapseBtn.click();
      await expect(sidebar).toHaveClass(/w-\[80px\]/);

      const expandBtn = page.getByLabel("Expand sidebar");
      await expandBtn.click();
      await expect(sidebar).toHaveClass(/w-\[256px\]/);
    } finally {
      await deleteUserByEmail(email);
    }
  });

  test("should toggle dark and light modes", async ({ page }) => {
    const email = await ensureSignedIn(page);
    try {
      await page.evaluate(() => localStorage.setItem("fairtab:theme", "dark"));
      await page.reload();
      const html = page.locator("html");
      await expect(html).not.toHaveClass(/light/);

      const themeBtn = page.getByLabel(/Switch to light/i);
      await themeBtn.click();
      await expect(html).toHaveClass(/light/);

      const themeBtnDark = page.getByLabel(/Switch to dark/i);
      await themeBtnDark.click();
      await expect(html).not.toHaveClass(/light/);
    } finally {
      await deleteUserByEmail(email);
    }
  });

  test("should open and close the add expense dialog", async ({ page }) => {
    const email = await ensureSignedIn(page);
    try {
      const addBtn = page.getByRole("button", { name: "New Expense" });
      await addBtn.click();

      const dialogTitle = page.locator("h2:has-text('Add Shared Expense')");
      await expect(dialogTitle).toBeVisible();

      const cancelBtn = page.getByRole("button", { name: "Cancel" });
      await cancelBtn.click();
      await expect(dialogTitle).not.toBeVisible();
    } finally {
      await deleteUserByEmail(email);
    }
  });

  test("should open the command palette using keyboard shortcut", async ({ page }) => {
    const email = await ensureSignedIn(page);
    try {
      await page.locator("body").click();
      await page.keyboard.press("Control+k");

      const searchInput = page.getByPlaceholder("Search shortcuts (Ctrl + K)...");
      await expect(searchInput).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(searchInput).not.toBeVisible();
    } finally {
      await deleteUserByEmail(email);
    }
  });

  test("should trap focus, close on Escape, and restore focus to original trigger", async ({ page }) => {
    const email = await ensureSignedIn(page);
    try {
      const addBtn = page.getByRole("button", { name: "New Expense" });
      await addBtn.focus();
      await expect(addBtn).toBeFocused();

      await page.keyboard.press("Enter");

      const dialogTitle = page.locator("h2:has-text('Add Shared Expense')");
      await expect(dialogTitle).toBeVisible();

      const groupSelect = page.locator("#exp-group");
      const createGroupBtn = page.getByRole("button", { name: "Create New Group" });
      if (await groupSelect.count() > 0) {
        await expect(groupSelect).toBeFocused();
      } else {
        await expect(createGroupBtn).toBeFocused();
      }

      // Press Tab multiple times to verify focus remains inside the dialog
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press("Tab");
      }

      const activeTagName = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
      expect(["input", "select", "button"]).toContain(activeTagName);

      const activeIsTrigger = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === "New Expense");
        return document.activeElement === btn;
      });
      expect(activeIsTrigger).toBe(false);

      await page.keyboard.press("Escape");
      await expect(dialogTitle).not.toBeVisible();
      await expect(addBtn).toBeFocused();
    } finally {
      await deleteUserByEmail(email);
    }
  });

  test("should apply transition overrides when reduced motion is emulated", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });

    // Reload page and sign in with reduced motion active
    const email = await ensureSignedIn(page);
    try {
      const sidebar = page.locator("aside");
      const transitionDuration = await sidebar.evaluate((el: Element) => {
        return window.getComputedStyle(el).transitionDuration;
      });

      expect(transitionDuration === "0s" || transitionDuration === "0ms").toBe(true);
    } finally {
      await deleteUserByEmail(email);
    }
  });
});
