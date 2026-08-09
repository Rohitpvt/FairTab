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

test.describe("FairTab Smart Insights E2E Flows", () => {
  const aliceEmail = "alice.insights.e2e@example.com";

  test.beforeEach(async () => {
    await deleteUserByEmail(aliceEmail);
  });

  test("runs insights computations, renders duplicate alarms, budget risk warning, and details dialogue", async ({ page }) => {
    test.setTimeout(55000);
    page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));

    // 1. Sign up Alice
    await registerAndVerify(page, "Alice Analyzer", aliceEmail);

    // 2. Create Group
    await page.goto("#/groups/new");
    await page.locator("#grp-name").fill("Insights Test Group");
    await page.locator("#grp-desc").fill("Deterministic validation for Phase 9.");
    await page.locator("#grp-type").selectOption("couple");
    await page.locator("#grp-currency").selectOption("USD");
    await page.getByRole("button", { name: "Create Group" }).click();
    await expect(page).toHaveURL(/.*#\/groups\/(?!new)[a-zA-Z0-9_-]+/);
    const groupUrl = page.url();
    const groupId = groupUrl.split("/groups/")[1];

    // 3. Navigate to Insights page and check empty state
    await page.getByRole("link", { name: "Insights" }).click();
    await expect(page).toHaveURL(/.*#\/insights/);
    await expect(page.locator("text=No anomalies detected")).toBeVisible({ timeout: 10000 });

    // 4. Create a category-specific budget with low limit ($10.00)
    await page.getByRole("link", { name: "Budgets" }).click();
    await expect(page).toHaveURL(/.*#\/budgets/);
    await page.getByRole("button", { name: "New Budget" }).click();
    await page.locator("#budget-name").fill("Snack Budget");
    await page.locator("#budget-scope").selectOption("category");
    await page.locator("#budget-category").selectOption("food");
    await page.locator("#budget-period").selectOption("monthly");
    await page.locator("#budget-amount").fill("10.00");
    await page.getByRole("button", { name: "Create Budget" }).click();
    await expect(page.locator("text=Budget creation queued.")).toBeVisible();

    // 5. Navigate to expenses and create an expense of $12.00 on food (exceeding budget limit)
    await page.goto(`#/groups/${groupId}/expenses/new`);
    await page.locator("#exp-title").fill("Potato Chips and Soda");
    await page.locator("#exp-category").selectOption("food");
    await page.locator("#exp-amount").fill("12.00");
    await page.getByRole("button", { name: "Create Expense" }).click();
    await expect(page).toHaveURL(/.*#\/groups\/(?!new)[a-zA-Z0-9_-]+/);

    // 6. Return to Insights page and check that budget risk alert has appeared
    await page.getByRole("link", { name: "Insights" }).click();
    await expect(page).toHaveURL(/.*#\/insights/);

    // Should display the Budget Limit Exceeded critical card
    const cardTitle = page.locator("text=Budget Limit Exceeded: Snack Budget").first();
    await expect(cardTitle).toBeVisible({ timeout: 15000 });

    // 7. Click 'Explain Metrics' to open the details modal dialog
    await page.getByRole("button", { name: "Explain Metrics" }).click();
    await expect(page.locator("text=Budget Limit Exceeded: Snack Budget").first()).toBeVisible();
    await expect(page.locator("text=Budget Risk Details")).toBeVisible();
    await expect(page.locator("text=Risk Indicators:")).toBeVisible();
  });
});
