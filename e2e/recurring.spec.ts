import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

const EMULATOR_PROJECT_ID = "mock-project-id";

interface OobCode {
  email: string;
  requestType: string;
  oobLink: string;
}

interface OobCodesResponse {
  oobCodes?: OobCode[];
}

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

async function registerAndVerify(page: Page, name: string, email: string): Promise<void> {
  await page.goto("", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.goto("", { waitUntil: "domcontentloaded" });

  // Register
  await page.goto("#/auth/register");
  await page.locator("#reg-name").fill(name);
  await page.locator("#reg-email").fill(email);
  await page.locator("#reg-password").fill("password123");
  await page.locator("#reg-confirm-password").fill("password123");
  await page.locator("#reg-remember-device").check();
  await page.getByRole("button", { name: "Create Account" }).dispatchEvent("click");

  // Redirect to verify email
  await expect(page).toHaveURL(/.*#\/auth\/verify-email/, { timeout: 15000 });

  // Verify email in emulator
  const verifyLink = await getVerificationLink(email);
  if (verifyLink) {
    await fetch(verifyLink);
  }

  // Refresh status
  await page.getByRole("button", { name: "Refresh Verification Status" }).dispatchEvent("click");

  // Onboarding
  await expect(page).toHaveURL(/.*#\/onboarding/, { timeout: 10000 });
  await page.getByRole("button", { name: "Next" }).dispatchEvent("click"); // Step 1
  await page.getByRole("button", { name: "Next" }).dispatchEvent("click"); // Step 2
  await page.getByRole("button", { name: "Next" }).dispatchEvent("click"); // Step 3
  await page.getByRole("button", { name: "Next" }).dispatchEvent("click"); // Step 4
  await page.getByRole("button", { name: "Complete Setup" }).dispatchEvent("click"); // Step 5

  await expect(page).toHaveURL(/.*#\/overview/, { timeout: 10000 });
}

test.describe("FairTab Phase 7 — Recurring Expenses & Scheduling E2E Tests", () => {
  let emailAlice: string;

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    const r = Math.random().toString(36).slice(2, 8);
    emailAlice = `alice-recur-${Date.now()}-${r}@example.com`;

    // Clean up local storage and IndexedDB
    await page.goto("", { waitUntil: "domcontentloaded" });
    await page.evaluate(async () => {
      localStorage.clear();
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("fairtab-offline-db");
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    });
  });

  test.afterEach(async () => {
    await deleteUserByEmail(emailAlice);
  });

  test("should manage templates, run due scans, approve/skip drafts, and handle offline queuing", async ({
    page,
    context,
  }) => {
    // 1. Register Alice
    await registerAndVerify(page, "Alice Recur", emailAlice);

    // 2. Create Group
    await page.goto("#/groups/new");
    await page.locator("#grp-name").fill("Recurring E2E Group");
    await page.locator("#grp-desc").fill("E2E Testing group");
    await page.locator("#grp-type").selectOption("home");
    await page.locator("#grp-currency").selectOption("USD");
    await page.getByRole("button", { name: "Create Group" }).click();

    await expect(page).toHaveURL(/.*#\/groups\/(?!new)[a-zA-Z0-9_-]+/, { timeout: 15000 });

    // 3. Navigate to Recurring bills page
    await page.goto("#/recurring");
    await expect(page.locator("text=No active recurring templates defined")).toBeVisible({ timeout: 10000 });

    // 4. Create Template (rent starting in past for catch-up)
    await page.getByRole("button", { name: "New Template" }).click();
    await page.locator('input[placeholder="e.g. Broadband Subscription"]').fill("Rent Bill");
    await page.locator('input[placeholder="0.00"]').fill("1200.00");
    await page.locator('input[type="date"]').fill("2026-01-31");
    await page.getByRole("button", { name: "Create Template" }).click();

    // Verify template is listed
    await expect(page.locator("text=Rent Bill")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=Next due: 2026-01-31")).toBeVisible();

    // 5. Trigger Due Scan
    const scanButton = page.getByRole("button", { name: "Scan Due Bills" });
    await scanButton.click();
    await expect(page.locator("text=generated")).toBeVisible({ timeout: 15000 });

    // Verify occurrences are listed (January 31 and February 28 due drafts generated)
    await expect(page.locator("text=Due: 2026-01-31")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=Due: 2026-02-28")).toBeVisible();

    // Next due on template should have progressed to August 31
    await expect(page.locator("text=Next due: 2026-08-31")).toBeVisible();

    // 6. Approve one occurrence draft
    const approveBtn = page.locator('button:has-text("Approve")').first();
    await approveBtn.click();
    await expect(page.locator("text=Recurring draft posted to ledger")).toBeVisible({ timeout: 15000 });
    // Verify January 31 draft has disappeared from pending list
    await expect(page.locator("text=Due: 2026-01-31")).not.toBeVisible();

    // 7. Skip second occurrence draft
    const skipBtn = page.locator('button:has-text("Skip")').first();
    await skipBtn.click();
    await expect(page.locator("text=skipped")).toBeVisible({ timeout: 15000 });
    // Verify February 28 draft has disappeared
    await expect(page.locator("text=Due: 2026-02-28")).not.toBeVisible();

    // 8. Offline queued action
    // Ensure group and data are cached, then set offline
    await context.setOffline(true);
    // Pause the Rent Bill template offline
    const toggleBtn = page.locator('button[aria-label^="Toggle active status for Rent Bill"]');
    await toggleBtn.click();

    // Verify offline warning/toast appears
    await expect(page.locator("text=Viewing offline cache")).toBeVisible({ timeout: 10000 });

    // Re-enable online mode
    await context.setOffline(false);
  });
});
