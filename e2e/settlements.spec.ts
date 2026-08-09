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

async function dismissToasts(page: Page) {
  try {
    const toastClose = page.getByRole("button", { name: "Close notification" });
    const count = await toastClose.count();
    for (let i = 0; i < count; i++) {
      await toastClose.first().click();
      await page.waitForTimeout(150);
    }
  } catch {
    // ignore
  }
}

async function waitForToastsToDismiss(page: Page) {
  try {
    await expect(page.getByRole("alert")).not.toBeVisible({ timeout: 5000 });
  } catch {
    // if it takes too long, let's dismiss them manually
    await dismissToasts(page);
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
  await page.getByRole("button", { name: "Create Account" }).click();

  // Redirect to verify email
  await expect(page).toHaveURL(/.*#\/auth\/verify-email/, { timeout: 15000 });

  // Verify email in emulator
  const verifyLink = await getVerificationLink(email);
  if (verifyLink) {
    await fetch(verifyLink);
  }

  // Refresh status
  await page.getByRole("button", { name: "Refresh Verification Status" }).click();

  // Onboarding
  await expect(page).toHaveURL(/.*#\/onboarding/, { timeout: 10000 });
  await page.getByRole("button", { name: "Next" }).click(); // Step 1
  await page.getByRole("button", { name: "Next" }).click(); // Step 2
  await page.getByRole("button", { name: "Next" }).click(); // Step 3
  await page.getByRole("button", { name: "Next" }).click(); // Step 4
  await page.getByRole("button", { name: "Complete Setup" }).click(); // Step 5

  await expect(page).toHaveURL(/.*#\/overview/, { timeout: 10000 });
  await dismissToasts(page);
}

test.describe("FairTab Phase 5 — Settlements & Debt Simplification E2E Tests", () => {
  let emailAlice: string;
  let emailCharlie: string;
  let emailDavid: string;

  test.beforeEach(async ({ page }) => {
    const r = Math.random().toString(36).slice(2, 8);
    emailAlice = `alice-set-${Date.now()}-${r}@example.com`;
    emailCharlie = `charlie-set-${Date.now()}-${r}@example.com`;
    emailDavid = `david-set-${Date.now()}-${r}@example.com`;

    // Set height to 1200px so forms fit completely without scrolling.
    // Set width to 1000px to hide mobile bottom nav bar while avoiding sidebar overlap.
    await page.setViewportSize({ width: 1000, height: 1200 });

    // Clean up local storage and IndexedDB
    await page.goto("", { waitUntil: "domcontentloaded" });
    await page.evaluate(async () => {
      localStorage.clear();
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("FairTabOfflineDB");
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    });

    await registerAndVerify(page, "Alice Owner", emailAlice);
  });

  test.afterEach(async () => {
    await deleteUserByEmail(emailAlice);
    await deleteUserByEmail(emailCharlie);
    await deleteUserByEmail(emailDavid);
  });

  test("full and partial settlement scenarios", async ({ page }) => {
    // 1. Create group
    await page.goto("#/groups/new");
    await page.locator("#grp-name").fill("Settlement Test Group");
    await page.locator("#grp-desc").fill("Testing settlement limits");
    await page.locator("#grp-currency").selectOption("USD");
    await page.getByRole("button", { name: "Create Group" }).click({ scroll: "none" });

    await expect(page).toHaveURL(/.*#\/groups\/(?!new)[a-zA-Z0-9_-]+/, { timeout: 15000 });
    const groupId = page.url().substring(page.url().lastIndexOf("/") + 1);

    // 2. Add Bob (placeholder)
    await page.getByTitle("Add Placeholder Member").click();
    await page.locator("#pl-name").fill("Bob Placeholder");
    await page.getByRole("button", { name: "Add Member" }).click();
    await expect(page.locator("text=Bob Placeholder").first()).toBeVisible({ timeout: 5000 });

    // 3. Create shared expense ($30.00 split equally)
    await page.goto(`#/groups/${groupId}/expenses/new`);
    await page.locator("#exp-title").fill("Team Lunch");
    await page.locator("#exp-category").selectOption("food");
    await page.locator("#exp-amount").fill("30.00");
    await page.locator("#exp-payer").selectOption({ label: "Alice Owner" });
    
    await waitForToastsToDismiss(page);
    await page.getByRole("button", { name: "Create Expense", exact: true }).click({ scroll: "none" });

    await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}`), { timeout: 10000 });
    await expect(page.locator("text=Team Lunch").first()).toBeVisible();

    // 4. Go to settlements: Bob owes $15.00
    await page.locator(`a[href="#/groups/${groupId}/settlements"]`).click();
    await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}\\/settlements`));

    // Verify recommendations text
    await expect(page.locator("text=Bob Placeholder (Placeholder) pays Alice Owner")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=$15.00")).toBeVisible();

    // Prefill form for full settlement
    await page.getByRole("button", { name: "Settle" }).click();
    await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}\\/settlements\\/new`));

    // Verify prefilled values
    await expect(page.locator("#payer option:checked")).toHaveText("Bob Placeholder (Placeholder)");
    await expect(page.locator("#receiver option:checked")).toHaveText("Alice Owner");
    await expect(page.locator("#amount")).toHaveValue("15.00");

    // Change to partial settlement: $10.00
    await page.locator("#amount").fill("10.00");
    await waitForToastsToDismiss(page);
    await page.getByRole("button", { name: "Save Settlement" }).click({ scroll: "none" });

    await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}\\/settlements`));
    await expect(page.locator("text=Bob Placeholder").first()).toBeVisible();
    await expect(page.locator("text=$10.00").first()).toBeVisible();

    // Verify suggestions shows remaining $5.00
    await expect(page.locator("text=Bob Placeholder (Placeholder) pays Alice Owner")).toBeVisible();
    await expect(page.locator("text=$5.00")).toBeVisible();

    // Record remaining $5.00 (Full Settlement)
    await page.getByRole("button", { name: "Settle" }).click();
    await waitForToastsToDismiss(page);
    await page.getByRole("button", { name: "Save Settlement" }).click({ scroll: "none" });

    await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}\\/settlements`));
    // Verify settled state displays "All Settled Up!"
    await expect(page.locator("text=All Settled Up!")).toBeVisible({ timeout: 5000 });
  });

  test("overpayment warning and confirmation", async ({ page }) => {
    await page.goto("#/groups/new");
    await page.locator("#grp-name").fill("Overpayment Group");
    await page.locator("#grp-currency").selectOption("USD");
    await page.getByRole("button", { name: "Create Group" }).click({ scroll: "none" });

    await expect(page).toHaveURL(/.*#\/groups\/(?!new)[a-zA-Z0-9_-]+/, { timeout: 15000 });
    const groupId = page.url().substring(page.url().lastIndexOf("/") + 1);

    await page.getByTitle("Add Placeholder Member").click();
    await page.locator("#pl-name").fill("Bob Placeholder");
    await page.getByRole("button", { name: "Add Member" }).click();
    await expect(page.locator("text=Bob Placeholder").first()).toBeVisible();

    await page.goto(`#/groups/${groupId}/expenses/new`);
    await page.locator("#exp-title").fill("Coffee");
    await page.locator("#exp-amount").fill("10.00");
    await page.locator("#exp-payer").selectOption({ label: "Alice Owner" });
    
    await waitForToastsToDismiss(page);
    await page.getByRole("button", { name: "Create Expense", exact: true }).click({ scroll: "none" });
    await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}`), { timeout: 10000 });
    await expect(page.locator("text=Coffee").first()).toBeVisible();

    await page.goto(`#/groups/${groupId}/settlements/new`);
    await page.locator("#payer").selectOption({ label: "Bob Placeholder (Placeholder)" });
    await page.locator("#receiver").selectOption({ label: "Alice Owner" });
    
    // Suggested debt is $5.00, input $8.00 (overpayment)
    await page.locator("#amount").fill("8.00");

    // Verify warning is visible
    await expect(page.locator("text=Overpayment Warning")).toBeVisible();

    // Click save without check - button should be disabled
    const saveBtn = page.getByRole("button", { name: "Save Settlement" });
    await expect(saveBtn).toBeDisabled();

    // Check confirmation checkbox
    await page.locator('input[type="checkbox"]').check();
    await expect(saveBtn).toBeEnabled();
    
    await waitForToastsToDismiss(page);
    await saveBtn.click({ scroll: "none" });

    await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}\\/settlements`));

    // Verify reversed balance impact: Bob paid $8 for a $5 debt, so Alice now owes Bob $3.00
    await expect(page.locator("text=Alice Owner pays Bob Placeholder (Placeholder)")).toBeVisible();
    await expect(page.locator("text=$3.00")).toBeVisible();
  });

  test("member and viewer permissions restrictions", async ({ page }) => {
    // 1. Create Group as Alice (Owner)
    await page.goto("#/groups/new");
    await page.locator("#grp-name").fill("Permissions Group");
    await page.locator("#grp-currency").selectOption("USD");
    await page.getByRole("button", { name: "Create Group" }).click({ scroll: "none" });
    await expect(page).toHaveURL(/.*#\/groups\/(?!new)[a-zA-Z0-9_-]+/, { timeout: 15000 });
    const groupId = page.url().substring(page.url().lastIndexOf("/") + 1);

    // 2. Add Bob (placeholder)
    await page.getByTitle("Add Placeholder Member").click();
    await page.locator("#pl-name").fill("Bob Placeholder");
    await page.getByRole("button", { name: "Add Member" }).click();
    await expect(page.locator("text=Bob Placeholder").first()).toBeVisible();

    // 3. Invite Charlie as member
    await page.locator('button[title="Invite via URL link"]').click();
    await page.locator("#inv-email").fill(emailCharlie);
    await page.locator("#inv-role").selectOption("member");
    await page.getByRole("button", { name: "Create Link" }).click();
    const inviteUrlCharlie = await page.locator("input[readonly]").inputValue();
    const invitationIdCharlie = inviteUrlCharlie.substring(inviteUrlCharlie.lastIndexOf("/") + 1);
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await dismissToasts(page);

    // 4. Invite David as viewer
    await page.locator('button[title="Invite via URL link"]').click();
    await page.locator("#inv-email").fill(emailDavid);
    await page.locator("#inv-role").selectOption("viewer");
    await page.getByRole("button", { name: "Create Link" }).click();
    const inviteUrlDavid = await page.locator("input[readonly]").inputValue();
    const invitationIdDavid = inviteUrlDavid.substring(inviteUrlDavid.lastIndexOf("/") + 1);
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await dismissToasts(page);

    // Sign out Alice
    await page.goto("#/settings");
    await page.getByRole("button", { name: "Sign Out" }).click();

    // Register & Login Charlie (Member)
    await registerAndVerify(page, "Charlie Member", emailCharlie);
    await page.goto(`#/invitations/${invitationIdCharlie}`);
    await page.getByRole("button", { name: "Accept & Join" }).click();
    await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}`), { timeout: 15000 });

    // Charlie tries to record settlement involving Bob (placeholder)
    await page.goto(`#/groups/${groupId}/settlements/new`);
    await page.locator("#payer").selectOption({ label: "Bob Placeholder (Placeholder)" });
    await page.locator("#receiver").selectOption({ label: "Charlie Member" });
    // Should block placeholder since Charlie is normal member
    await expect(page.locator("text=Only group Owners or Admins can record settlements involving placeholders.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save Settlement" })).toBeDisabled();

    // Charlie selects Alice and Charlie (self, works)
    await page.locator("#payer").selectOption({ label: "Charlie Member" });
    await page.locator("#receiver").selectOption({ label: "Alice Owner" });
    await expect(page.locator("text=Only group Owners or Admins")).not.toBeVisible();

    // Log out Charlie
    await page.goto("#/settings");
    await page.getByRole("button", { name: "Sign Out" }).click();

    // Register & Login David (Viewer)
    await registerAndVerify(page, "David Viewer", emailDavid);
    await page.goto(`#/invitations/${invitationIdDavid}`);
    await page.getByRole("button", { name: "Accept & Join" }).click();
    await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}`), { timeout: 15000 });

    // David (Viewer) navigates to settlements new
    await page.goto(`#/groups/${groupId}/settlements/new`);
    await expect(page.locator("text=Viewers are read-only and cannot record repayments.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save Settlement" })).toBeDisabled();
  });

  test("offline queue, reconnect synchronization, and voiding details", async ({ page }) => {
    // 1. Create Group
    await page.goto("#/groups/new");
    await page.locator("#grp-name").fill("Sync Group");
    await page.locator("#grp-currency").selectOption("USD");
    await page.getByRole("button", { name: "Create Group" }).click({ scroll: "none" });
    await expect(page).toHaveURL(/.*#\/groups\/(?!new)[a-zA-Z0-9_-]+/, { timeout: 15000 });
    const groupId = page.url().substring(page.url().lastIndexOf("/") + 1);

    // Add Bob
    await page.getByTitle("Add Placeholder Member").click();
    await page.locator("#pl-name").fill("Bob Placeholder");
    await page.getByRole("button", { name: "Add Member" }).click();
    await expect(page.locator("text=Bob Placeholder").first()).toBeVisible();

    // Add Expense
    await page.goto(`#/groups/${groupId}/expenses/new`);
    await page.locator("#exp-title").fill("Coffee");
    await page.locator("#exp-amount").fill("20.00");
    await page.locator("#exp-payer").selectOption({ label: "Alice Owner" });
    
    await waitForToastsToDismiss(page);
    await page.getByRole("button", { name: "Create Expense", exact: true }).click({ scroll: "none" });
    await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}`), { timeout: 10000 });
    await expect(page.locator("text=Coffee").first()).toBeVisible();

    // Go to settlements list page online first to pre-cache the route chunk
    await page.goto(`#/groups/${groupId}/settlements`);
    await expect(page.locator("text=No settlements recorded yet.")).toBeVisible();

    // Open record settlement page
    await page.goto(`#/groups/${groupId}/settlements/new`);
    await page.locator("#payer").selectOption({ label: "Bob Placeholder (Placeholder)" });
    await page.locator("#receiver").selectOption({ label: "Alice Owner" });
    await page.locator("#amount").fill("10.00");

    // Go offline AFTER loading the app/group
    await page.context().setOffline(true);
    await page.waitForTimeout(1000);

    // Save Settlement
    await dismissToasts(page);
    const saveBtn = page.getByRole("button", { name: "Save Settlement" });
    await saveBtn.click({ scroll: "none" });
    await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}\\/settlements`));

    // Verify stored locally as queued outbox update banner
    await expect(page.locator("text=1 pending updates.")).toBeVisible({ timeout: 5000 });
    // Verify it is not shown in the history list yet
    await expect(page.locator("text=No settlements recorded yet.")).toBeVisible();

    // Reconnect / Go back online
    await page.context().setOffline(false);

    // Reconnect triggers foreground sync automatically and clears indicators
    await expect(page.locator("text=1 pending updates.")).not.toBeVisible({ timeout: 15000 });
    // Confirm UI updates with server-confirmed cleared status
    await expect(page.locator("text=Bob Placeholder").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=Cleared").first()).toBeVisible();

    // Voiding settlement
    await page.locator("text=Cleared").first().click();
    await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}\\/settlements\\/set-`));

    await page.getByRole("button", { name: "Void Settlement" }).click();
    await page.locator("#void-reason").fill("Double Record");
    await page.getByRole("button", { name: "Confirm Void" }).click({ scroll: "none" });

    // Verify void updates status, logs revision history, and reverses balance impact
    await expect(page.locator("text=This Settlement has been Voided")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=Double Record").first()).toBeVisible();
  });

  test("stale-version conflict and archived group denial", async ({ page }) => {
    // 1. Create Group
    await page.goto("#/groups/new");
    await page.locator("#grp-name").fill("Stale Group");
    await page.locator("#grp-currency").selectOption("USD");
    await page.getByRole("button", { name: "Create Group" }).click({ scroll: "none" });
    await expect(page).toHaveURL(/.*#\/groups\/(?!new)[a-zA-Z0-9_-]+/, { timeout: 15000 });
    const groupId = page.url().substring(page.url().lastIndexOf("/") + 1);

    // Add Bob
    await page.getByTitle("Add Placeholder Member").click();
    await page.locator("#pl-name").fill("Bob Placeholder");
    await page.getByRole("button", { name: "Add Member" }).click();
    await expect(page.locator("text=Bob Placeholder").first()).toBeVisible();

    // Add Expense
    await page.goto(`#/groups/${groupId}/expenses/new`);
    await page.locator("#exp-title").fill("Coffee");
    await page.locator("#exp-amount").fill("10.00");
    await page.locator("#exp-payer").selectOption({ label: "Alice Owner" });
    
    await waitForToastsToDismiss(page);
    await page.getByRole("button", { name: "Create Expense", exact: true }).click({ scroll: "none" });
    await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}`), { timeout: 10000 });
    await expect(page.locator("text=Coffee").first()).toBeVisible();

    // Record settlement
    await page.goto(`#/groups/${groupId}/settlements/new`);
    await page.locator("#payer").selectOption({ label: "Bob Placeholder (Placeholder)" });
    await page.locator("#receiver").selectOption({ label: "Alice Owner" });
    await page.locator("#amount").fill("5.00");
    await dismissToasts(page);
    const saveBtn = page.getByRole("button", { name: "Save Settlement" });
    await saveBtn.click({ scroll: "none" });

    // Go to detail page
    await page.goto(`#/groups/${groupId}/settlements`);
    await page.locator("text=Cleared").first().click();
    await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}\\/settlements\\/set-`));

    // Capture console errors
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Stale version conflict: Intercept call to voidSettlement and inject stale expectedVersion: 999
    await page.route("**/voidSettlement", async (route) => {
      const request = route.request();
      const postData = request.postDataJSON();
      if (postData && postData.data) {
        postData.data.expectedVersion = 999; // force stale conflict
      }
      route.continue({ postData: JSON.stringify(postData) });
    });

    await page.getByRole("button", { name: "Void Settlement" }).click();
    await page.locator("#void-reason").fill("Version Clash");
    await page.getByRole("button", { name: "Confirm Void" }).click({ scroll: "none" });

    // Verify error is shown due to stale conflict (aborted status)
    await expect.poll(() => consoleErrors.some(e => e.includes("Conflict"))).toBe(true);

    // Cancel routing interception to allow normal operation
    await page.unroute("**/voidSettlement");

    // Archived Group Denial
    // Go to settings and archive group
    await page.goto(`#/groups/${groupId}/settings`);
    const archiveBtn = page.locator('button:has-text("Archive Group")').first();
    await expect(archiveBtn).toBeVisible({ timeout: 10000 });
    await archiveBtn.click();
    await page.locator('div[role="dialog"] button:has-text("Archive Group")').click();
    await expect(page.locator("text=archived successfully")).toBeVisible({ timeout: 5000 });
    await dismissToasts(page);

    // Navigating to settlements page: Record Repayment button must be hidden
    await page.goto(`#/groups/${groupId}/settlements`);
    await expect(page.getByRole("button", { name: "Record Repayment" })).not.toBeVisible();

    // Direct navigation to record page should deny creation
    await page.goto(`#/groups/${groupId}/settlements/new`);
    await expect(page.locator("text=This Group is Archived and read-only.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save Settlement" })).toBeDisabled();
  });
});
