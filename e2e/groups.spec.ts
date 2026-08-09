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
  // Clear localStorage
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

  // Land on overview
  await expect(page).toHaveURL(/.*#\/overview/, { timeout: 10000 });
}

test.describe("FairTab Phase 3 — Groups, Members, and Invitations E2E Tests", () => {
  let emailA: string;
  let emailB: string;

  test.beforeEach(() => {
    const r = Math.random().toString(36).slice(2, 8);
    emailA = `user-a-${Date.now()}-${r}@example.com`;
    emailB = `user-b-${Date.now()}-${r}@example.com`;
  });

  test.afterEach(async () => {
    await deleteUserByEmail(emailA);
    await deleteUserByEmail(emailB);
  });

  test("create group, add placeholder, invite user, accept invitation", async ({ page }) => {
    // 1. Sign in User A
    await registerAndVerify(page, "User Alice", emailA);

    // 2. Navigate to Groups & Create Group
    await page.goto("#/groups");
    await page.getByRole("button", { name: "Create Group" }).first().click();
    await expect(page).toHaveURL(/.*#\/groups\/new/);

    await page.locator("#grp-name").fill("Trip to Alps 2026");
    await page.locator("#grp-desc").fill("Skiing holiday");
    await page.locator("#grp-type").selectOption("trip");
    await page.locator("#grp-currency").selectOption("EUR");
    await page.getByRole("button", { name: "Create Group" }).click();

    // Verify redirected to detail page
    await expect(page).toHaveURL(/.*#\/groups\/[a-zA-Z0-9_-]+/, { timeout: 15000 });

    // Verify User Alice is Owner
    await expect(page.locator("text=User Alice").first()).toBeVisible();
    await expect(page.locator("text=owner").first()).toBeVisible();

    // 3. Add Placeholder Member
    await page.locator('button[title="Add Placeholder Member"]').click();
    await page.locator("#pl-name").fill("Offline Bob");
    await page.getByRole("button", { name: "Add Member" }).click();

    // Verify placeholder added
    await expect(page.locator("text=Offline Bob").first()).toBeVisible();
    await expect(page.locator("text=Offline Placeholder").first()).toBeVisible();

    // 4. Invite User B via email & Copy invite URL
    await page.locator('button[title="Invite via URL link"]').click();
    await page.locator("#inv-email").fill(emailB);
    await page.locator("#inv-role").selectOption("member");
    await page.getByRole("button", { name: "Create Link" }).click();

    // Wait for Link box
    const readOnlyInput = page.locator("input[readonly]");
    await expect(readOnlyInput).toBeVisible();
    const inviteUrl = await readOnlyInput.inputValue();
    const invitationId = inviteUrl.substring(inviteUrl.lastIndexOf("/") + 1);

    // Sign out User A via settings page
    await page.goto("#/settings");
    await page.getByRole("button", { name: "Sign Out" }).click();
    await expect(page).toHaveURL(/.*#\/auth\/login/, { timeout: 10000 });

    // 5. Register and login User B
    await registerAndVerify(page, "User Charlie", emailB);

    // Force sign-out and sign-in to get a fresh token with email_verified: true
    // (Firebase Auth Emulator may not update email_verified in cached tokens)
    await page.goto("#/settings");
    await page.getByRole("button", { name: "Sign Out" }).click();
    await expect(page).toHaveURL(/.*#\/auth\/login/, { timeout: 10000 });

    // Sign back in as Charlie
    await page.locator("#login-email").fill(emailB);
    await page.locator("#login-password").fill("password123");
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page).toHaveURL(/.*#\/overview/, { timeout: 10000 });

    // Navigate directly to accept link
    await page.goto(`#/invitations/${invitationId}`);
    await expect(page.locator("text=Trip to Alps 2026").first()).toBeVisible();
    await expect(page.locator("text=Proposed role: member")).toBeVisible();

    // Accept & Join
    await page.getByRole("button", { name: "Accept & Join" }).click();

    // Redirected to Group detail
    await expect(page).toHaveURL(/.*#\/groups\/[a-zA-Z0-9_-]+/, { timeout: 15000 });

    // Verify both User Alice and User Charlie are in the list
    await expect(page.locator("text=User Alice").first()).toBeVisible();
    await expect(page.locator("text=User Charlie").first()).toBeVisible();
  });
});
