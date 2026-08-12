# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: settlements.spec.ts >> FairTab Phase 5 — Settlements & Debt Simplification E2E Tests >> member and viewer permissions restrictions
- Location: e2e\settlements.spec.ts:265:3

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
              - generic: Synced
              - button
              - generic: AL
          - main:
            - generic:
              - generic:
                - generic:
                  - heading [level=1]: Permissions Group
                  - paragraph: Split ledger group using USD.
                - generic:
                  - generic:
                    - link:
                      - /url: "#/groups/HVtzkYEx0JM3FCF6i3Hk/settlements"
                      - button:
                        - generic: Settlements
                    - link:
                      - /url: "#/groups/HVtzkYEx0JM3FCF6i3Hk/settings"
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
                              - /url: "#/groups/HVtzkYEx0JM3FCF6i3Hk/receipts/new"
                              - button:
                                - generic: Scan Receipt
                            - link:
                              - /url: "#/groups/HVtzkYEx0JM3FCF6i3Hk/expenses/new"
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
                            - paragraph: Placeholder member "Bob Placeholder" added.
                            - text: 8/12/2026, 9:35:10 AM
                        - generic:
                          - generic:
                            - paragraph: Group "Permissions Group" created by Alice Owner.
                            - text: 8/12/2026, 9:35:10 AM
                  - generic:
                    - generic:
                      - heading [level=3]: Balance Projection (USD)
                      - generic:
                        - generic:
                          - generic:
                            - generic: Alice Owner
                            - generic: owner
                          - generic: $0.00
                        - generic:
                          - generic:
                            - generic: Bob Placeholder
                            - generic: Offline Placeholder
                          - generic: $0.00
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
                              - text: Alice Owner
                              - generic: You
                            - generic: owner
                        - generic:
                          - generic:
                            - generic: Bob Placeholder
                            - generic: Offline Placeholder
                          - generic:
                            - button
    - status:
      - generic: Firebase Emulators Active
  - dialog [ref=f2e2]:
    - generic [ref=f2e3]:
      - generic [ref=f2e4]:
        - heading "Invite Group Member" [level=2] [ref=f2e6]
        - button "Close dialog" [active] [ref=f2e7] [cursor=pointer]
      - generic [ref=f2e12]:
        - generic [ref=f2e13]:
          - button "Invite by Email" [ref=f2e14] [cursor=pointer]
          - button "Share Invite Link" [ref=f2e15] [cursor=pointer]
        - generic [ref=f2e16]:
          - paragraph [ref=f2e17]: Send a personalized invitation directly. The invitee will join the group immediately upon accepting from their registered email.
          - generic [ref=f2e18]:
            - generic [ref=f2e19]: Email Address
            - textbox "Email Address" [ref=f2e20]:
              - /placeholder: friend@example.com
          - generic [ref=f2e21]:
            - generic [ref=f2e22]: Proposed Role
            - combobox "Proposed Role" [ref=f2e23]:
              - option "Member (Can split expenses)" [selected]
              - option "Admin (Can manage members)"
              - option "Viewer (Read-only)"
          - generic [ref=f2e24]:
            - button "Cancel" [ref=f2e25]
            - button "Send Invitation" [ref=f2e27]
```

# Test source

```ts
  182 |     await page.getByRole("button", { name: "Settle" }).click();
  183 |     await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}\\/settlements\\/new`));
  184 | 
  185 |     // Verify prefilled values
  186 |     await expect(page.locator("#payer option:checked")).toHaveText("Bob Placeholder (Placeholder)");
  187 |     await expect(page.locator("#receiver option:checked")).toHaveText("Alice Owner");
  188 |     await expect(page.locator("#amount")).toHaveValue("15.00");
  189 | 
  190 |     // Change to partial settlement: $10.00
  191 |     await page.locator("#amount").fill("10.00");
  192 |     await waitForToastsToDismiss(page);
  193 |     await page.getByRole("button", { name: "Save Settlement" }).click({ scroll: "none" });
  194 | 
  195 |     await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}\\/settlements`));
  196 |     await expect(page.locator("text=Bob Placeholder").first()).toBeVisible();
  197 |     await expect(page.locator("text=$10.00").first()).toBeVisible();
  198 | 
  199 |     // Verify suggestions shows remaining $5.00
  200 |     await expect(page.locator("text=Bob Placeholder (Placeholder) pays Alice Owner")).toBeVisible();
  201 |     await expect(page.locator("text=$5.00")).toBeVisible();
  202 | 
  203 |     // Record remaining $5.00 (Full Settlement)
  204 |     await page.getByRole("button", { name: "Settle" }).click();
  205 |     await waitForToastsToDismiss(page);
  206 |     await page.getByRole("button", { name: "Save Settlement" }).click({ scroll: "none" });
  207 | 
  208 |     await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}\\/settlements`));
  209 |     // Verify settled state displays "All Settled Up!"
  210 |     await expect(page.locator("text=All Settled Up!")).toBeVisible({ timeout: 5000 });
  211 |   });
  212 | 
  213 |   test("overpayment warning and confirmation", async ({ page }) => {
  214 |     await page.goto("#/groups/new");
  215 |     await page.locator("#grp-name").fill("Overpayment Group");
  216 |     await page.locator("#grp-currency").selectOption("USD");
  217 |     await page.getByRole("button", { name: "Create Group" }).click({ scroll: "none" });
  218 | 
  219 |     await expect(page).toHaveURL(/.*#\/groups\/(?!new)[a-zA-Z0-9_-]+/, { timeout: 15000 });
  220 |     const groupId = page.url().substring(page.url().lastIndexOf("/") + 1);
  221 | 
  222 |     await page.getByTitle("Add Placeholder Member").click();
  223 |     await page.locator("#pl-name").fill("Bob Placeholder");
  224 |     await page.getByRole("button", { name: "Add Member" }).click();
  225 |     await expect(page.locator("text=Bob Placeholder").first()).toBeVisible();
  226 | 
  227 |     await page.goto(`#/groups/${groupId}/expenses/new`);
  228 |     await page.locator("#exp-title").fill("Coffee");
  229 |     await page.locator("#exp-amount").fill("10.00");
  230 |     await page.locator("#exp-payer").selectOption({ label: "Alice Owner" });
  231 |     
  232 |     await waitForToastsToDismiss(page);
  233 |     await page.getByRole("button", { name: "Create Expense", exact: true }).click({ scroll: "none" });
  234 |     await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}`), { timeout: 10000 });
  235 |     await expect(page.locator("text=Coffee").first()).toBeVisible();
  236 | 
  237 |     await page.goto(`#/groups/${groupId}/settlements/new`);
  238 |     await page.locator("#payer").selectOption({ label: "Bob Placeholder (Placeholder)" });
  239 |     await page.locator("#receiver").selectOption({ label: "Alice Owner" });
  240 |     
  241 |     // Suggested debt is $5.00, input $8.00 (overpayment)
  242 |     await page.locator("#amount").fill("8.00");
  243 | 
  244 |     // Verify warning is visible
  245 |     await expect(page.locator("text=Overpayment Warning")).toBeVisible();
  246 | 
  247 |     // Click save without check - button should be disabled
  248 |     const saveBtn = page.getByRole("button", { name: "Save Settlement" });
  249 |     await expect(saveBtn).toBeDisabled();
  250 | 
  251 |     // Check confirmation checkbox
  252 |     await page.locator('input[type="checkbox"]').check();
  253 |     await expect(saveBtn).toBeEnabled();
  254 |     
  255 |     await waitForToastsToDismiss(page);
  256 |     await saveBtn.click({ scroll: "none" });
  257 | 
  258 |     await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}\\/settlements`));
  259 | 
  260 |     // Verify reversed balance impact: Bob paid $8 for a $5 debt, so Alice now owes Bob $3.00
  261 |     await expect(page.locator("text=Alice Owner pays Bob Placeholder (Placeholder)")).toBeVisible();
  262 |     await expect(page.locator("text=$3.00")).toBeVisible();
  263 |   });
  264 | 
  265 |   test("member and viewer permissions restrictions", async ({ page }) => {
  266 |     // 1. Create Group as Alice (Owner)
  267 |     await page.goto("#/groups/new");
  268 |     await page.locator("#grp-name").fill("Permissions Group");
  269 |     await page.locator("#grp-currency").selectOption("USD");
  270 |     await page.getByRole("button", { name: "Create Group" }).click({ scroll: "none" });
  271 |     await expect(page).toHaveURL(/.*#\/groups\/(?!new)[a-zA-Z0-9_-]+/, { timeout: 15000 });
  272 |     const groupId = page.url().substring(page.url().lastIndexOf("/") + 1);
  273 | 
  274 |     // 2. Add Bob (placeholder)
  275 |     await page.getByTitle("Add Placeholder Member").click();
  276 |     await page.locator("#pl-name").fill("Bob Placeholder");
  277 |     await page.getByRole("button", { name: "Add Member" }).click();
  278 |     await expect(page.locator("text=Bob Placeholder").first()).toBeVisible();
  279 | 
  280 |     // 3. Invite Charlie as member
  281 |     await page.locator('button[title="Invite via URL link"]').click();
> 282 |     await page.locator("#inv-email").fill(emailCharlie);
      |                                      ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  283 |     await page.locator("#inv-role").selectOption("member");
  284 |     await page.getByRole("button", { name: "Create Link" }).click();
  285 |     const inviteUrlCharlie = await page.locator("input[readonly]").inputValue();
  286 |     const invitationIdCharlie = inviteUrlCharlie.substring(inviteUrlCharlie.lastIndexOf("/") + 1);
  287 |     await page.getByRole("button", { name: "Close", exact: true }).click();
  288 |     await dismissToasts(page);
  289 | 
  290 |     // 4. Invite David as viewer
  291 |     await page.locator('button[title="Invite via URL link"]').click();
  292 |     await page.locator("#inv-email").fill(emailDavid);
  293 |     await page.locator("#inv-role").selectOption("viewer");
  294 |     await page.getByRole("button", { name: "Create Link" }).click();
  295 |     const inviteUrlDavid = await page.locator("input[readonly]").inputValue();
  296 |     const invitationIdDavid = inviteUrlDavid.substring(inviteUrlDavid.lastIndexOf("/") + 1);
  297 |     await page.getByRole("button", { name: "Close", exact: true }).click();
  298 |     await dismissToasts(page);
  299 | 
  300 |     // Sign out Alice
  301 |     await page.goto("#/settings");
  302 |     await page.getByRole("button", { name: "Sign Out" }).click();
  303 | 
  304 |     // Register & Login Charlie (Member)
  305 |     await registerAndVerify(page, "Charlie Member", emailCharlie);
  306 |     await page.goto(`#/invitations/${invitationIdCharlie}`);
  307 |     await page.getByRole("button", { name: "Accept & Join" }).click();
  308 |     await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}`), { timeout: 15000 });
  309 | 
  310 |     // Charlie tries to record settlement involving Bob (placeholder)
  311 |     await page.goto(`#/groups/${groupId}/settlements/new`);
  312 |     await page.locator("#payer").selectOption({ label: "Bob Placeholder (Placeholder)" });
  313 |     await page.locator("#receiver").selectOption({ label: "Charlie Member" });
  314 |     // Should block placeholder since Charlie is normal member
  315 |     await expect(page.locator("text=Only group Owners or Admins can record settlements involving placeholders.")).toBeVisible();
  316 |     await expect(page.getByRole("button", { name: "Save Settlement" })).toBeDisabled();
  317 | 
  318 |     // Charlie selects Alice and Charlie (self, works)
  319 |     await page.locator("#payer").selectOption({ label: "Charlie Member" });
  320 |     await page.locator("#receiver").selectOption({ label: "Alice Owner" });
  321 |     await expect(page.locator("text=Only group Owners or Admins")).not.toBeVisible();
  322 | 
  323 |     // Log out Charlie
  324 |     await page.goto("#/settings");
  325 |     await page.getByRole("button", { name: "Sign Out" }).click();
  326 | 
  327 |     // Register & Login David (Viewer)
  328 |     await registerAndVerify(page, "David Viewer", emailDavid);
  329 |     await page.goto(`#/invitations/${invitationIdDavid}`);
  330 |     await page.getByRole("button", { name: "Accept & Join" }).click();
  331 |     await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}`), { timeout: 15000 });
  332 | 
  333 |     // David (Viewer) navigates to settlements new
  334 |     await page.goto(`#/groups/${groupId}/settlements/new`);
  335 |     await expect(page.locator("text=Viewers are read-only and cannot record repayments.")).toBeVisible();
  336 |     await expect(page.getByRole("button", { name: "Save Settlement" })).toBeDisabled();
  337 |   });
  338 | 
  339 |   test("offline queue, reconnect synchronization, and voiding details", async ({ page }) => {
  340 |     // 1. Create Group
  341 |     await page.goto("#/groups/new");
  342 |     await page.locator("#grp-name").fill("Sync Group");
  343 |     await page.locator("#grp-currency").selectOption("USD");
  344 |     await page.getByRole("button", { name: "Create Group" }).click({ scroll: "none" });
  345 |     await expect(page).toHaveURL(/.*#\/groups\/(?!new)[a-zA-Z0-9_-]+/, { timeout: 15000 });
  346 |     const groupId = page.url().substring(page.url().lastIndexOf("/") + 1);
  347 | 
  348 |     // Add Bob
  349 |     await page.getByTitle("Add Placeholder Member").click();
  350 |     await page.locator("#pl-name").fill("Bob Placeholder");
  351 |     await page.getByRole("button", { name: "Add Member" }).click();
  352 |     await expect(page.locator("text=Bob Placeholder").first()).toBeVisible();
  353 | 
  354 |     // Add Expense
  355 |     await page.goto(`#/groups/${groupId}/expenses/new`);
  356 |     await page.locator("#exp-title").fill("Coffee");
  357 |     await page.locator("#exp-amount").fill("20.00");
  358 |     await page.locator("#exp-payer").selectOption({ label: "Alice Owner" });
  359 |     
  360 |     await waitForToastsToDismiss(page);
  361 |     await page.getByRole("button", { name: "Create Expense", exact: true }).click({ scroll: "none" });
  362 |     await expect(page).toHaveURL(new RegExp(`.*#\\/groups\\/${groupId}`), { timeout: 10000 });
  363 |     await expect(page.locator("text=Coffee").first()).toBeVisible();
  364 | 
  365 |     // Go to settlements list page online first to pre-cache the route chunk
  366 |     await page.goto(`#/groups/${groupId}/settlements`);
  367 |     await expect(page.locator("text=No settlements recorded yet.")).toBeVisible();
  368 | 
  369 |     // Open record settlement page
  370 |     await page.goto(`#/groups/${groupId}/settlements/new`);
  371 |     await page.locator("#payer").selectOption({ label: "Bob Placeholder (Placeholder)" });
  372 |     await page.locator("#receiver").selectOption({ label: "Alice Owner" });
  373 |     await page.locator("#amount").fill("10.00");
  374 | 
  375 |     // Go offline AFTER loading the app/group
  376 |     await page.context().setOffline(true);
  377 |     await page.waitForTimeout(1000);
  378 | 
  379 |     // Save Settlement
  380 |     await dismissToasts(page);
  381 |     const saveBtn = page.getByRole("button", { name: "Save Settlement" });
  382 |     await saveBtn.click({ scroll: "none" });
```