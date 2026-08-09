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

test.describe("FairTab Phase 6 — Receipts, OCR, and Itemized Expenses E2E Tests", () => {
  let emailAlice: string;

  test.beforeEach(async ({ page }) => {
    const r = Math.random().toString(36).slice(2, 8);
    emailAlice = `alice-rcpt-${Date.now()}-${r}@example.com`;

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

  test("should navigate to receipt scan page and display the upload form", async ({ page }) => {
    // 1. Register Alice
    await registerAndVerify(page, "Alice Receipt", emailAlice);

    // 2. Create Group
    await page.goto("#/groups/new");
    await page.locator("#grp-name").fill("Receipt Test Group");
    await page.locator("#grp-desc").fill("Group for testing receipts");
    await page.locator("#grp-type").selectOption("trip");
    await page.locator("#grp-currency").selectOption("USD");
    await page.getByRole("button", { name: "Create Group" }).click();

    await expect(page).toHaveURL(/.*#\/groups\/(?!new)[a-zA-Z0-9_-]+/, { timeout: 15000 });
    const url = page.url();
    const groupId = url.substring(url.lastIndexOf("/") + 1);

    // 3. Find and click Scan Receipt button
    const scanButton = page.getByRole("button", { name: /Scan Receipt/i });
    await expect(scanButton).toBeVisible({ timeout: 10000 });
    await scanButton.click();

    // 4. Verify we landed on the receipt scan page
    await expect(page).toHaveURL(new RegExp(`.*#/groups/${groupId}/receipts/new`), { timeout: 10000 });

    // 5. Verify drag-drop zone is visible
    const uploadZone = page.locator("text=Drag & drop receipt image or PDF");
    await expect(uploadZone).toBeVisible({ timeout: 5000 });

    // 6. Verify file type hints
    await expect(page.locator("text=JPEG / PNG")).toBeVisible();
    await expect(page.locator("text=PDF Document")).toBeVisible();
    await expect(page.locator("text=Max size: 5MB")).toBeVisible();
  });

  test("should reject oversized files via client-side validation", async ({ page }) => {
    // 1. Register Alice and create group
    await registerAndVerify(page, "Alice Size", emailAlice);

    await page.goto("#/groups/new");
    await page.locator("#grp-name").fill("Size Test Group");
    await page.locator("#grp-desc").fill("Testing file size limits");
    await page.locator("#grp-type").selectOption("home");
    await page.locator("#grp-currency").selectOption("USD");
    await page.getByRole("button", { name: "Create Group" }).click();

    await expect(page).toHaveURL(/.*#\/groups\/(?!new)[a-zA-Z0-9_-]+/, { timeout: 15000 });
    const url = page.url();
    const groupId = url.substring(url.lastIndexOf("/") + 1);

    // 2. Navigate to receipt page
    await page.goto(`#/groups/${groupId}/receipts/new`);
    await expect(page.locator("text=Drag & drop receipt image or PDF")).toBeVisible({ timeout: 5000 });

    // 3. Upload an oversized file (> 5MB) using the hidden file input
    const fileInput = page.locator('input[type="file"]');
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
    await fileInput.setInputFiles({
      name: "huge-receipt.jpg",
      mimeType: "image/jpeg",
      buffer: largeBuffer,
    });

    // 4. Verify the error toast appears
    const errorToast = page.locator("text=File is too large");
    await expect(errorToast).toBeVisible({ timeout: 5000 });
  });

  test("should reject unsupported MIME types via client-side validation", async ({ page }) => {
    // 1. Register Alice and create group
    await registerAndVerify(page, "Alice MIME", emailAlice);

    await page.goto("#/groups/new");
    await page.locator("#grp-name").fill("MIME Test Group");
    await page.locator("#grp-desc").fill("Testing MIME restrictions");
    await page.locator("#grp-type").selectOption("home");
    await page.locator("#grp-currency").selectOption("USD");
    await page.getByRole("button", { name: "Create Group" }).click();

    await expect(page).toHaveURL(/.*#\/groups\/(?!new)[a-zA-Z0-9_-]+/, { timeout: 15000 });
    const url = page.url();
    const groupId = url.substring(url.lastIndexOf("/") + 1);

    // 2. Navigate to receipt page
    await page.goto(`#/groups/${groupId}/receipts/new`);
    await expect(page.locator("text=Drag & drop receipt image or PDF")).toBeVisible({ timeout: 5000 });

    // 3. Upload a .txt file (unsupported MIME)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("This is a text file, not a receipt"),
    });

    // 4. Verify the error toast appears
    const errorToast = page.locator("text=Unsupported file type");
    await expect(errorToast).toBeVisible({ timeout: 5000 });
  });

  test("should accept a valid JPEG and transition to OCR review step", async ({ page }) => {
    // 1. Register Alice and create group
    await registerAndVerify(page, "Alice OCR", emailAlice);

    await page.goto("#/groups/new");
    await page.locator("#grp-name").fill("OCR Test Group");
    await page.locator("#grp-desc").fill("Testing OCR flow");
    await page.locator("#grp-type").selectOption("trip");
    await page.locator("#grp-currency").selectOption("USD");
    await page.getByRole("button", { name: "Create Group" }).click();

    await expect(page).toHaveURL(/.*#\/groups\/(?!new)[a-zA-Z0-9_-]+/, { timeout: 15000 });
    const url = page.url();
    const groupId = url.substring(url.lastIndexOf("/") + 1);

    // 2. Navigate to receipt page
    await page.goto(`#/groups/${groupId}/receipts/new`);
    await expect(page.locator("text=Drag & drop receipt image or PDF")).toBeVisible({ timeout: 5000 });

    // 3. Upload a valid small JPEG
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "receipt.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("fake-jpeg-image-bytes-for-testing"),
    });

    // 4. The page should transition to review step with OCR fields
    // Wait for either OCR processing indicator or the review form
    const reviewHeading = page.locator("text=Review & Confirm OCR Extraction");
    await expect(reviewHeading).toBeVisible({ timeout: 20000 });

    // 5. Verify OCR fields are populated (mock data from MockOcrProvider or offline mock)
    const merchantInput = page.locator('input[placeholder="Merchant Name"]');
    await expect(merchantInput).toBeVisible({ timeout: 5000 });

    // 6. Verify "Upload different file" back button exists
    const backButton = page.locator("text=Upload different file");
    await expect(backButton).toBeVisible();

    // 7. Verify Itemized Line Items section exists
    const itemsSection = page.locator("text=Itemized Line Items");
    await expect(itemsSection).toBeVisible();

    // 8. Verify Pro-rata Tax & Tip Allocation table exists
    const allocSection = page.locator("text=Pro-rata Tax & Tip Allocation");
    await expect(allocSection).toBeVisible();

    // 9. Verify payer selection dropdown exists
    const payerLabel = page.locator("text=Who Paid?");
    await expect(payerLabel).toBeVisible();

    // 10. Verify submit button
    const submitButton = page.getByRole("button", { name: /Save and Create Expense/i });
    await expect(submitButton).toBeVisible();
  });

  test("should show reconciliation error when items subtotal does not match", async ({ page }) => {
    // 1. Register Alice and create group
    await registerAndVerify(page, "Alice Reconcile", emailAlice);

    await page.goto("#/groups/new");
    await page.locator("#grp-name").fill("Reconcile Group");
    await page.locator("#grp-desc").fill("Reconciliation testing");
    await page.locator("#grp-type").selectOption("home");
    await page.locator("#grp-currency").selectOption("USD");
    await page.getByRole("button", { name: "Create Group" }).click();

    await expect(page).toHaveURL(/.*#\/groups\/(?!new)[a-zA-Z0-9_-]+/, { timeout: 15000 });
    const url = page.url();
    const groupId = url.substring(url.lastIndexOf("/") + 1);

    // 2. Navigate to receipt page and upload a file
    await page.goto(`#/groups/${groupId}/receipts/new`);
    await expect(page.locator("text=Drag & drop receipt image or PDF")).toBeVisible({ timeout: 5000 });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "receipt.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("fake-jpeg-image-bytes"),
    });

    // Wait for review form
    await expect(page.locator("text=Review & Confirm OCR Extraction")).toBeVisible({ timeout: 20000 });

    // 3. Manually change subtotal to create a mismatch
    const subtotalInput = page.locator('input[type="number"]').first();
    await subtotalInput.fill("999.99");

    // 4. Verify the reconciliation warning appears
    const warningText = page.locator("text=Totals do not reconcile");
    await expect(warningText).toBeVisible({ timeout: 5000 });

    // 5. Verify submit button is disabled when not reconciled
    const submitButton = page.getByRole("button", { name: /Save and Create Expense/i });
    await expect(submitButton).toBeDisabled();
  });
});
