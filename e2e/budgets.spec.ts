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
  await page.getByRole("button", { name: "Create Account" }).click();

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

test.describe("FairTab Budget & Analytics E2E Flows", () => {
  const aliceEmail = "alice.bgt.e2e@example.com";

  test.beforeEach(async () => {
    await deleteUserByEmail(aliceEmail);
  });

  test("creates group, budget, posts expense, verifies progress, analytics breakdown, and export", async ({ page }) => {
    test.setTimeout(45000);
    page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));

    // 1. Sign up Alice
    await registerAndVerify(page, "Alice Budgeter", aliceEmail);

    // 2. Create Group
    await page.goto("#/groups/new");
    await page.locator("#grp-name").fill("Family Cabin Trip");
    await page.locator("#grp-desc").fill("Shared expenses for summer vacation.");
    await page.locator("#grp-type").selectOption("trip");
    await page.locator("#grp-currency").selectOption("USD");
    await page.getByRole("button", { name: "Create Group" }).click();
    await expect(page).toHaveURL(/.*#\/groups\/(?!new)[a-zA-Z0-9_-]+/);
    const groupUrl = page.url();
    const groupId = groupUrl.split("/groups/")[1];

    // 3. Navigate to Budgets dashboard
    await page.getByRole("link", { name: "Budgets" }).click();
    await expect(page.locator("text=No active budgets.")).toBeVisible({ timeout: 10000 });

    // 4. Create new budget
    await page.getByRole("button", { name: "New Budget" }).click();
    await page.locator("#budget-name").fill("Overall Vacation Allowance");
    await page.locator("#budget-amount").fill("500.00");
    await page.locator("#budget-period").selectOption("monthly");
    await page.getByRole("button", { name: "Create Budget" }).click();

    // Verify progress card appears
    await expect(page.locator("text=Overall Vacation Allowance")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=$0.00 / $500.00")).toBeVisible();

    // 5. Post an expense to consume the budget
    await page.goto(`#/groups/${groupId}/expenses/new`);
    await page.locator('#exp-title').fill("Cabin Grocery");
    await page.locator('#exp-amount').fill("150.00");
    await page.locator("#exp-category").selectOption("food");
    await page.getByRole("button", { name: "Create Expense" }).click();
    await expect(page).toHaveURL(/.*#\/groups\/(?!new)[a-zA-Z0-9_-]+/);

    // 6. Check budget progress updates
    await page.getByRole("link", { name: "Budgets" }).click();
    await expect(page.locator("text=$150.00 / $500.00")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=30% Used")).toBeVisible();

    // 7. Inspect Analytics Page
    await page.getByRole("link", { name: "Analytics" }).click();
    await expect(page.locator("text=Category Distribution")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Total Category Spent")).toBeVisible();
    await expect(page.locator("text=$150.00").first()).toBeVisible();

    // 8. Open Export Dialog
    await page.getByRole("button", { name: "Export Ledger" }).click();
    await expect(page.locator("text=Export Group Ledger Data")).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.locator("text=Export Group Ledger Data")).not.toBeVisible();
  });
});
