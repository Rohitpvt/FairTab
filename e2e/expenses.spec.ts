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

test.describe("FairTab Phase 4 — Expense Ledger & Split Engine E2E Tests", () => {
  let emailAlice: string;

  test.beforeEach(async ({ page }) => {
    const r = Math.random().toString(36).slice(2, 8);
    emailAlice = `alice-${Date.now()}-${r}@example.com`;

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

  test("should support equal, exact, percentage, and share splits, offline sync, conflict resolution, and voiding", async ({ page }) => {
    // 1. Register Alice
    await registerAndVerify(page, "Alice Owner", emailAlice);

    // 2. Create Group
    await page.goto("#/groups/new");
    await page.locator("#grp-name").fill("Ski Holiday 2026");
    await page.locator("#grp-desc").fill("Annual ski trip");
    await page.locator("#grp-type").selectOption("trip");
    await page.locator("#grp-currency").selectOption("EUR");
    await page.getByRole("button", { name: "Create Group" }).click();

    await expect(page).toHaveURL(/.*#\/groups\/(?!new)[a-zA-Z0-9_-]+/, { timeout: 15000 });
    const url = page.url();
    const groupId = url.substring(url.lastIndexOf("/") + 1);

    // 3. Add Placeholder bob
    await page.locator('button[title="Add Placeholder Member"]').click();
    await page.locator("#pl-name").fill("Bob Placeholder");
    await page.getByRole("button", { name: "Add Member" }).click();
    await expect(page.locator("text=Bob Placeholder").first()).toBeVisible();

    // 4. Equal Split Expense Creation
    await page.getByRole("link", { name: "Add Expense" }).click({ force: true });
    await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}\\/expenses\\/new`));

    await page.locator("#exp-title").fill("Chalet Rental");
    await page.locator("#exp-category").selectOption("housing");
    await page.locator("#exp-amount").fill("150.00");
    
    // Split method should be equal by default, both participants selected
    await page.getByRole("button", { name: "Create Expense", exact: true }).dispatchEvent("click");
    await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}`));

    // Verify Chalet Rental listed
    await expect(page.locator("text=Chalet Rental").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=€150.00").first()).toBeVisible({ timeout: 15000 });

    // Verify Balance updates: Alice paid 150, owes 75. Bob owes 75.
    // Alice net: +75.00, Bob net: -75.00
    await expect(page.locator("text=+€75.00").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=-€75.00").first()).toBeVisible({ timeout: 15000 });

    // 5. Exact Split Expense Creation
    await page.getByRole("link", { name: "Add Expense" }).click({ force: true });
    await page.locator("#exp-title").fill("Ski Pass");
    await page.locator("#exp-category").selectOption("entertainment");
    await page.locator("#exp-amount").fill("120.00");
    await page.locator('button', { hasText: "Exact" }).click();
    // Assign custom amounts
    const exactInputs = page.locator('input[placeholder="0.00"]:not(#exp-amount)');
    await exactInputs.nth(0).fill("80.00"); // Alice
    await exactInputs.nth(1).fill("40.00"); // Bob
    await page.getByRole("button", { name: "Create Expense", exact: true }).dispatchEvent("click");
    await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}`));
    await expect(page.locator("text=Ski Pass").first()).toBeVisible({ timeout: 15000 });

    // 6. Percentage Split Expense Creation
    await page.getByRole("link", { name: "Add Expense" }).click({ force: true });
    await page.locator("#exp-title").fill("Group Lunch");
    await page.locator("#exp-category").selectOption("food");
    await page.locator("#exp-amount").fill("100.00");
    await page.locator('button', { hasText: "Percentage" }).click();
    const percentInputs = page.locator('input[placeholder="0"]');
    await percentInputs.nth(0).fill("70.00"); // Alice 70%
    await percentInputs.nth(1).fill("30.00"); // Bob 30%
    await page.getByRole("button", { name: "Create Expense", exact: true }).dispatchEvent("click");
    await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}`));
    await expect(page.locator("text=Group Lunch").first()).toBeVisible({ timeout: 15000 });

    // 7. Shares Split Expense Creation
    await page.getByRole("link", { name: "Add Expense" }).click({ force: true });
    await page.locator("#exp-title").fill("Snack Supplies");
    await page.locator("#exp-category").selectOption("food");
    await page.locator("#exp-amount").fill("30.00");
    await page.locator('button', { hasText: "Shares" }).click();
    const shareInputs = page.locator('input[placeholder="1"]');
    await shareInputs.nth(0).fill("2"); // Alice 2 shares
    await shareInputs.nth(1).fill("1"); // Bob 1 share
    await page.getByRole("button", { name: "Create Expense", exact: true }).dispatchEvent("click");
    await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}`));
    await expect(page.locator("text=Snack Supplies").first()).toBeVisible({ timeout: 15000 });

    // 8. Offline Outbox Sync and Queue
    await page.getByRole("link", { name: "Add Expense" }).click({ force: true });
    await page.locator("#exp-title").fill("Offline Coffee");
    await page.locator("#exp-category").selectOption("food");
    await page.locator("#exp-amount").fill("9.00");
    await page.context().setOffline(true);
    await page.getByRole("button", { name: "Create Expense", exact: true }).dispatchEvent("click");

    // Redirect to group page immediately
    await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}`));
    // Should show pending outbox count indicator
    await expect(page.locator("text=1 pending updates.").first()).toBeVisible({ timeout: 15000 });

    // Go back online
    await page.context().setOffline(false);
    // Should sync automatically and remove pending indicator
    await expect(page.locator("text=1 pending updates.")).not.toBeVisible({ timeout: 15000 });
    // And now Offline Coffee should be visible on the list
    await expect(page.locator("text=Offline Coffee").first()).toBeVisible({ timeout: 15000 });

    // 9. Voiding an expense
    await page.locator('xpath=//div[contains(@class, "rounded-xl")][.//*[contains(text(), "Offline Coffee")]]//a').dispatchEvent("click");
    await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}\\/expenses\\/[a-zA-Z0-9_-]+`));
    await page.getByRole("button", { name: "Void", exact: true }).dispatchEvent("click");
    await page.locator('form input[type="text"]').fill("Duplicate input");
    await page.locator('form button[type="submit"]').dispatchEvent("click");

    // Redirection and Status Voided
    await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}`));
    await expect(page.locator("text=Voided").first()).toBeVisible({ timeout: 15000 });

    // 10. Conflict Resolution Manual Reapplication
    // Let's create an expense to edit
    await page.getByRole("link", { name: "Add Expense" }).click({ force: true });
    await page.locator("#exp-title").fill("Dinner Edit Target");
    await page.locator("#exp-category").selectOption("food");
    await page.locator("#exp-amount").fill("40.00");
    await page.getByRole("button", { name: "Create Expense", exact: true }).dispatchEvent("click");
    await expect(page.locator("text=Dinner Edit Target").first()).toBeVisible({ timeout: 15000 });

    // Click it to view details
    await page.locator('xpath=//div[contains(@class, "rounded-xl")][.//*[contains(text(), "Dinner Edit Target")]]//a').dispatchEvent("click");
    const detailUrl = page.url();
    const expenseId = detailUrl.substring(detailUrl.lastIndexOf("/") + 1);

    // Edit 1: Navigate to Edit Details online, wait for dynamic import to load, then go offline and save
    await page.getByRole("link", { name: "Edit", exact: true }).dispatchEvent("click");
    await expect(page.locator("#exp-title")).toBeVisible();
    await page.context().setOffline(true);
    await page.locator("#exp-title").fill("Offline Edit 1");
    await page.getByRole("button", { name: "Save Changes" }).dispatchEvent("click");
    await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}`));

    // Edit 2: Edit again offline, edit title to "Offline Edit 2" (expectedVersion targets version 1)
    await page.locator('xpath=//div[contains(@class, "rounded-xl")][.//*[contains(text(), "Dinner Edit Target")]]//a').dispatchEvent("click");
    await page.getByRole("link", { name: "Edit", exact: true }).dispatchEvent("click");
    await page.locator("#exp-title").fill("Offline Edit 2");
    await page.getByRole("button", { name: "Save Changes" }).dispatchEvent("click");
    await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}`));

    // Go back online
    await page.context().setOffline(false);

    // Edit 1 succeeds, Edit 2 fails with conflict (ExpectedVersion mismatch)
    // The conflict dialog should pop up!
    await expect(page.locator("text=Version Mismatch Conflict Detected")).toBeVisible({ timeout: 15000 });

    // Click Reapply Changes
    await page.getByRole("button", { name: "Reapply Changes (Merge Manually)" }).dispatchEvent("click");
    // Should navigate back to the Edit page pre-populated with "Offline Edit 2"
    await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}\\/expenses\\/${expenseId}\\/edit`));
    await expect(page.locator("#exp-title")).toHaveValue("Offline Edit 2");

    // Click Save Changes to submit targeting the latest server version
    await page.getByRole("button", { name: "Save Changes" }).dispatchEvent("click");
    await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}`));
    await expect(page.locator("text=Dinner Edit Target")).not.toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=Offline Edit 2").first()).toBeVisible({ timeout: 15000 });
  });
});
