# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: groups.spec.ts >> FairTab Phase 3 — Groups, Members, and Invitations E2E Tests >> create group, add placeholder, invite user, accept invitation
- Location: e2e\groups.spec.ts:101:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('#inv-email')

```

# Page snapshot

```yaml
- generic:
  - generic:
    - generic:
      - region "Notifications alt+T"
      - alert:
        - generic:
          - generic:
            - generic:
              - heading "Offline Ready" [level=4]
              - paragraph: FairTab has been cached for offline use. You can access it without connection.
          - button "Close notification"
      - generic:
        - complementary:
          - generic:
            - generic:
              - generic: FT
              - generic: FairTab
          - navigation:
            - link:
              - /url: "#/overview"
              - generic: Overview
            - link:
              - /url: "#/groups"
              - generic: Groups
            - link:
              - /url: "#/expenses"
              - generic: Expenses
            - link:
              - /url: "#/settlements"
              - generic: Settlements
            - link:
              - /url: "#/analytics"
              - generic: Analytics
            - link:
              - /url: "#/budgets"
              - generic: Budgets
            - link:
              - /url: "#/insights"
              - generic: Insights
            - link:
              - /url: "#/recurring"
              - generic: Recurring
            - link:
              - /url: "#/notifications"
              - generic: Notifications
            - link:
              - /url: "#/settings"
              - generic: Settings
          - generic:
            - button
        - generic:
          - banner:
            - generic:
              - heading [level=3]: FairTab
            - generic:
              - button:
                - generic: Search shortcuts...
                - generic: Ctrl K
              - generic: Synced
              - button
              - generic:
                - generic: US
                - generic: user-a-1786507413828-cp92v9@example.com
          - main:
            - generic:
              - generic:
                - generic:
                  - heading [level=1]: Trip to Alps 2026
                  - paragraph: Skiing holiday
                - generic:
                  - generic:
                    - link:
                      - /url: "#/groups/49XZt5c4qi6DydR47yRU/settlements"
                      - button:
                        - generic: Settlements
                    - link:
                      - /url: "#/groups/49XZt5c4qi6DydR47yRU/settings"
                      - button:
                        - generic: Settings
              - generic:
                - generic:
                  - generic:
                    - generic:
                      - generic:
                        - generic:
                          - generic:
                            - heading [level=3]: Ledger Transactions
                            - paragraph: Review, filter, and track group expenditures.
                          - generic:
                            - link:
                              - /url: "#/groups/49XZt5c4qi6DydR47yRU/receipts/new"
                              - button:
                                - generic: Scan Receipt
                            - link:
                              - /url: "#/groups/49XZt5c4qi6DydR47yRU/expenses/new"
                              - button:
                                - generic: Add Expense
                        - generic:
                          - generic:
                            - textbox:
                              - /placeholder: Search by title or payer...
                          - combobox
                        - generic: No matching transactions logged in this group ledger.
                    - generic:
                      - heading [level=3]: Recent Activity Feed
                      - generic:
                        - generic:
                          - generic:
                            - paragraph: Placeholder member "Offline Bob" added.
                            - text: 8/12/2026, 9:33:37 AM
                        - generic:
                          - generic:
                            - paragraph: Group "Trip to Alps 2026" created by User Alice.
                            - text: 8/12/2026, 9:33:36 AM
                  - generic:
                    - generic:
                      - heading [level=3]: Balance Projection (EUR)
                      - generic:
                        - generic:
                          - generic:
                            - generic: User Alice
                            - generic: owner
                          - generic: €0.00
                        - generic:
                          - generic:
                            - generic: Offline Bob
                            - generic: Offline Placeholder
                          - generic: €0.00
                    - generic:
                      - generic:
                        - heading [level=3]: Members (2)
                        - generic:
                          - button
                          - button
                      - generic:
                        - generic:
                          - generic:
                            - generic:
                              - text: User Alice
                              - generic: You
                            - generic: owner
                        - generic:
                          - generic:
                            - generic: Offline Bob
                            - generic: Offline Placeholder
                          - generic:
                            - button
    - status:
      - generic: Firebase Emulators Active
  - dialog [ref=f1e2]:
    - generic [ref=f1e3]:
      - generic [ref=f1e4]:
        - heading "Invite Group Member" [level=2] [ref=f1e6]
        - button "Close dialog" [active] [ref=f1e7] [cursor=pointer]
      - generic [ref=f1e12]:
        - generic [ref=f1e13]:
          - button "Invite by Email" [ref=f1e14] [cursor=pointer]
          - button "Share Invite Link" [ref=f1e15] [cursor=pointer]
        - generic [ref=f1e16]:
          - paragraph [ref=f1e17]: Send a personalized invitation directly. The invitee will join the group immediately upon accepting from their registered email.
          - generic [ref=f1e18]:
            - generic [ref=f1e19]: Email Address
            - textbox "Email Address" [ref=f1e20]:
              - /placeholder: friend@example.com
          - generic [ref=f1e21]:
            - generic [ref=f1e22]: Proposed Role
            - combobox "Proposed Role" [ref=f1e23]:
              - option "Member (Can split expenses)" [selected]
              - option "Admin (Can manage members)"
              - option "Viewer (Read-only)"
          - generic [ref=f1e24]:
            - button "Cancel" [ref=f1e25]
            - button "Send Invitation" [ref=f1e27]
```

# Test source

```ts
  34  |     const users = listData.users || [];
  35  |     const targetUser = users.find((u) => u.email === email);
  36  |     if (targetUser) {
  37  |       await fetch(
  38  |         `http://127.0.0.1:9099/emulator/v1/projects/${EMULATOR_PROJECT_ID}/accounts/${targetUser.localId}`,
  39  |         { method: "DELETE" }
  40  |       );
  41  |     }
  42  |   } catch (e) {
  43  |     console.warn(`Could not delete user ${email} from emulator`, e);
  44  |   }
  45  | }
  46  | 
  47  | async function registerAndVerify(page: Page, name: string, email: string): Promise<void> {
  48  |   // Clear localStorage
  49  |   await page.goto("", { waitUntil: "domcontentloaded" });
  50  |   await page.evaluate(() => localStorage.clear());
  51  |   await page.goto("", { waitUntil: "domcontentloaded" });
  52  | 
  53  |   // Register
  54  |   await page.goto("#/auth/register");
  55  |   await page.locator("#reg-name").fill(name);
  56  |   await page.locator("#reg-email").fill(email);
  57  |   await page.locator("#reg-password").fill("password123");
  58  |   await page.locator("#reg-confirm-password").fill("password123");
  59  |   await page.locator("#reg-remember-device").check();
  60  |   await page.getByRole("button", { name: "Create Account" }).dispatchEvent("click");
  61  | 
  62  |   // Redirect to verify email
  63  |   await expect(page).toHaveURL(/.*#\/auth\/verify-email/, { timeout: 15000 });
  64  | 
  65  |   // Verify email in emulator
  66  |   const verifyLink = await getVerificationLink(email);
  67  |   if (verifyLink) {
  68  |     await fetch(verifyLink);
  69  |   }
  70  | 
  71  |   // Refresh status
  72  |   await page.getByRole("button", { name: "Refresh Verification Status" }).dispatchEvent("click");
  73  | 
  74  |   // Onboarding
  75  |   await expect(page).toHaveURL(/.*#\/onboarding/, { timeout: 10000 });
  76  |   await page.getByRole("button", { name: "Next" }).dispatchEvent("click"); // Step 1
  77  |   await page.getByRole("button", { name: "Next" }).dispatchEvent("click"); // Step 2
  78  |   await page.getByRole("button", { name: "Next" }).dispatchEvent("click"); // Step 3
  79  |   await page.getByRole("button", { name: "Next" }).dispatchEvent("click"); // Step 4
  80  |   await page.getByRole("button", { name: "Complete Setup" }).dispatchEvent("click"); // Step 5
  81  | 
  82  |   // Land on overview
  83  |   await expect(page).toHaveURL(/.*#\/overview/, { timeout: 10000 });
  84  | }
  85  | 
  86  | test.describe("FairTab Phase 3 — Groups, Members, and Invitations E2E Tests", () => {
  87  |   let emailA: string;
  88  |   let emailB: string;
  89  | 
  90  |   test.beforeEach(() => {
  91  |     const r = Math.random().toString(36).slice(2, 8);
  92  |     emailA = `user-a-${Date.now()}-${r}@example.com`;
  93  |     emailB = `user-b-${Date.now()}-${r}@example.com`;
  94  |   });
  95  | 
  96  |   test.afterEach(async () => {
  97  |     await deleteUserByEmail(emailA);
  98  |     await deleteUserByEmail(emailB);
  99  |   });
  100 | 
  101 |   test("create group, add placeholder, invite user, accept invitation", async ({ page }) => {
  102 |     // 1. Sign in User A
  103 |     await registerAndVerify(page, "User Alice", emailA);
  104 | 
  105 |     // 2. Navigate to Groups & Create Group
  106 |     await page.goto("#/groups");
  107 |     await page.getByRole("button", { name: "Create Group" }).first().click();
  108 |     await expect(page).toHaveURL(/.*#\/groups\/new/);
  109 | 
  110 |     await page.locator("#grp-name").fill("Trip to Alps 2026");
  111 |     await page.locator("#grp-desc").fill("Skiing holiday");
  112 |     await page.locator("#grp-type").selectOption("trip");
  113 |     await page.locator("#grp-currency").selectOption("EUR");
  114 |     await page.getByRole("button", { name: "Create Group" }).click();
  115 | 
  116 |     // Verify redirected to detail page
  117 |     await expect(page).toHaveURL(/.*#\/groups\/[a-zA-Z0-9_-]+/, { timeout: 15000 });
  118 | 
  119 |     // Verify User Alice is Owner
  120 |     await expect(page.locator("text=User Alice").first()).toBeVisible();
  121 |     await expect(page.locator("text=owner").first()).toBeVisible();
  122 | 
  123 |     // 3. Add Placeholder Member
  124 |     await page.locator('button[title="Add Placeholder Member"]').click();
  125 |     await page.locator("#pl-name").fill("Offline Bob");
  126 |     await page.getByRole("button", { name: "Add Member" }).click();
  127 | 
  128 |     // Verify placeholder added
  129 |     await expect(page.locator("text=Offline Bob").first()).toBeVisible();
  130 |     await expect(page.locator("text=Offline Placeholder").first()).toBeVisible();
  131 | 
  132 |     // 4. Invite User B via email & Copy invite URL
  133 |     await page.locator('button[title="Invite via URL link"]').click();
> 134 |     await page.locator("#inv-email").fill(emailB);
      |                                      ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  135 |     await page.locator("#inv-role").selectOption("member");
  136 |     await page.getByRole("button", { name: "Create Link" }).click();
  137 | 
  138 |     // Wait for Link box
  139 |     const readOnlyInput = page.locator("input[readonly]");
  140 |     await expect(readOnlyInput).toBeVisible();
  141 |     const inviteUrl = await readOnlyInput.inputValue();
  142 |     const invitationId = inviteUrl.substring(inviteUrl.lastIndexOf("/") + 1);
  143 | 
  144 |     // Sign out User A via settings page
  145 |     await page.goto("#/settings");
  146 |     await page.getByRole("button", { name: "Sign Out" }).click();
  147 |     await expect(page).toHaveURL(/.*#\/auth\/login/, { timeout: 10000 });
  148 | 
  149 |     // 5. Register and login User B
  150 |     await registerAndVerify(page, "User Charlie", emailB);
  151 | 
  152 |     // Force sign-out and sign-in to get a fresh token with email_verified: true
  153 |     // (Firebase Auth Emulator may not update email_verified in cached tokens)
  154 |     await page.goto("#/settings");
  155 |     await page.getByRole("button", { name: "Sign Out" }).click();
  156 |     await expect(page).toHaveURL(/.*#\/auth\/login/, { timeout: 10000 });
  157 | 
  158 |     // Sign back in as Charlie
  159 |     await page.locator("#login-email").fill(emailB);
  160 |     await page.locator("#login-password").fill("password123");
  161 |     await page.getByRole("button", { name: "Sign In", exact: true }).click();
  162 |     await expect(page).toHaveURL(/.*#\/overview/, { timeout: 10000 });
  163 | 
  164 |     // Navigate directly to accept link
  165 |     await page.goto(`#/invitations/${invitationId}`);
  166 |     await expect(page.locator("text=Trip to Alps 2026").first()).toBeVisible();
  167 |     await expect(page.locator("text=Proposed role: member")).toBeVisible();
  168 | 
  169 |     // Accept & Join
  170 |     await page.getByRole("button", { name: "Accept & Join" }).click();
  171 | 
  172 |     // Redirected to Group detail
  173 |     await expect(page).toHaveURL(/.*#\/groups\/[a-zA-Z0-9_-]+/, { timeout: 15000 });
  174 | 
  175 |     // Verify both User Alice and User Charlie are in the list
  176 |     await expect(page.locator("text=User Alice").first()).toBeVisible();
  177 |     await expect(page.locator("text=User Charlie").first()).toBeVisible();
  178 |   });
  179 | });
  180 | 
```