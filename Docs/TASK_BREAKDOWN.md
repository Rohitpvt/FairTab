# FairTab — Task Breakdown

Task IDs are designed for direct import into Antigravity, GitHub Issues, or a project board.

Priority:
- P0 critical
- P1 important
- P2 enhancement

---

## EPIC-00 Project governance

- **FS-001 P0** Create repository and branch protections.
- **FS-002 P0** Add README, licence, `.gitignore`, environment example.
- **FS-003 P0** Configure Node/npm versions.
- **FS-004 P0** Configure ESLint, Prettier, TypeScript strict mode.
- **FS-005 P0** Create CI workflow.
- **FS-006 P0** Create GitHub Pages deployment workflow.
- **FS-007 P1** Add issue and pull-request templates.
- **FS-008 P0** Add architecture decision record directory.
- **FS-009 P0** Add documentation index.
- **FS-010 P0** Define centralized application limits.

Acceptance:
- clean checkout installs with `npm ci`;
- CI passes;
- blank production build deploys.

---

## EPIC-01 Design system

- **FS-101 P0** Implement dark theme tokens.
- **FS-102 P0** Implement gradient background and ambient orbs.
- **FS-103 P0** Implement glass surface variants and fallback.
- **FS-104 P0** Implement typography and tabular number styles.
- **FS-105 P0** Build button variants with loading state.
- **FS-106 P0** Build form controls and validation messages.
- **FS-107 P0** Build modal, dialog, drawer, and mobile bottom sheet.
- **FS-108 P0** Build skeleton primitives.
- **FS-109 P0** Build dashboard/group/expense/chart skeletons.
- **FS-110 P0** Build empty and error states.
- **FS-111 P0** Build toast system.
- **FS-112 P0** Build responsive app shell.
- **FS-113 P0** Build desktop sidebar.
- **FS-114 P0** Build mobile bottom navigation.
- **FS-115 P1** Build command palette.
- **FS-116 P0** Add reduced-motion support.
- **FS-117 P0** Add visual component test page.

---

## EPIC-02 Firebase foundation

- **FS-201 P0** Create Firebase development project.
- **FS-202 P0** Register web application.
- **FS-203 P0** Configure environment validation.
- **FS-204 P0** Initialize modular Firebase SDK.
- **FS-205 P0** Configure Auth providers.
- **FS-206 P0** Initialize Firestore local persistence.
- **FS-207 P0** Add Firebase Emulator configuration.
- **FS-208 P0** Create baseline deny-all Firestore rules.
- **FS-209 P0** Create baseline deny-all Storage rules.
- **FS-210 P0** Add rules test harness.
- **FS-211 P1** Evaluate App Check for GitHub Pages.
- **FS-212 P0** Document dev/prod Firebase separation.

---

## EPIC-03 Authentication

- **FS-301 P0** Registration form.
- **FS-302 P0** Email/password login.
- **FS-303 P0** Google sign-in.
- **FS-304 P0** Password reset.
- **FS-305 P1** Email verification UX.
- **FS-306 P0** Auth provider/context.
- **FS-307 P0** Protected route.
- **FS-308 P0** User profile creation.
- **FS-309 P0** Friendly auth error mapping.
- **FS-310 P0** Trusted-device offline consent.
- **FS-311 P0** Sign-out pending-change flow.
- **FS-312 P0** Cache clearing.
- **FS-313 P1** Onboarding.

---

## EPIC-04 PWA and local storage

- **FS-401 P0** Configure `vite-plugin-pwa`.
- **FS-402 P0** Create manifest and icons.
- **FS-403 P0** Create custom service worker.
- **FS-404 P0** Precache shell.
- **FS-405 P0** Navigation fallback.
- **FS-406 P0** Runtime caching policies.
- **FS-407 P0** Update-available prompt.
- **FS-408 P0** Create Dexie database.
- **FS-409 P0** Implement local schema migrations.
- **FS-410 P0** Create pending operation store.
- **FS-411 P0** Create pending attachment store.
- **FS-412 P0** Create draft store.
- **FS-413 P0** Add offline/online detector.
- **FS-414 P0** Add sync-status component.
- **FS-415 P0** Test installability.

---

## EPIC-05 Groups

- **FS-501 P0** Group domain model and Zod schema.
- **FS-502 P0** Group repository.
- **FS-503 P0** Group creation wizard.
- **FS-504 P0** Group list and skeleton.
- **FS-505 P0** Group detail shell.
- **FS-506 P0** Group edit/archive.
- **FS-507 P0** Member model.
- **FS-508 P0** Add placeholder member.
- **FS-509 P0** Role management.
- **FS-510 P0** User group index.
- **FS-511 P0** Group membership rules.
- **FS-512 P0** Role-escalation rule tests.
- **FS-513 P1** Invitation model and UI.
- **FS-514 P1** Invite acceptance.
- **FS-515 P1** Leave/remove member.
- **FS-516 P1** Group activity feed.

---

## EPIC-06 Money and split engine

- **FS-601 P0** Currency metadata.
- **FS-602 P0** Money minor-unit utilities.
- **FS-603 P0** Decimal-safe formatter/parser.
- **FS-604 P0** Equal split algorithm.
- **FS-605 P0** Exact split validation.
- **FS-606 P0** Percentage/basis-point split.
- **FS-607 P0** Shares split.
- **FS-608 P0** Weighted split.
- **FS-609 P0** Multi-payer allocation.
- **FS-610 P0** Deterministic rounding remainder.
- **FS-611 P0** Property-based tests.
- **FS-612 P0** Split explanation output.

---

## EPIC-07 Expenses

- **FS-701 P0** Expense schema.
- **FS-702 P0** Expense repository.
- **FS-703 P0** Add-expense wizard.
- **FS-704 P0** Payer editor.
- **FS-705 P0** Participant editor.
- **FS-706 P0** Split method selector.
- **FS-707 P0** Review screen.
- **FS-708 P0** Expense list with pagination.
- **FS-709 P0** Expense detail.
- **FS-710 P0** Edit with base version.
- **FS-711 P0** Soft delete and undo.
- **FS-712 P0** Duplicate expense.
- **FS-713 P0** Expense Firestore rules.
- **FS-714 P0** Expense rules tests.
- **FS-715 P0** Offline expense E2E.

---

## EPIC-08 Balance and settlement

- **FS-801 P0** Balance engine.
- **FS-802 P0** Balance trace.
- **FS-803 P0** Per-currency grouping.
- **FS-804 P0** Balance property tests.
- **FS-805 P0** Dashboard balance cards.
- **FS-806 P0** Settlement schema/repository.
- **FS-807 P0** Record settlement form.
- **FS-808 P0** Settlement reversal.
- **FS-809 P0** Settlement rules.
- **FS-810 P0** Greedy simplification engine.
- **FS-811 P0** Simplification explanation.
- **FS-812 P1** Preserve-relationship mode.
- **FS-813 P1** Excluded counterparty constraints.

---

## EPIC-09 Sync engine

- **FS-901 P0** Mutation envelope and IDs.
- **FS-902 P0** Persist-before-success write path.
- **FS-903 P0** Queue dependency ordering.
- **FS-904 P0** Replay worker.
- **FS-905 P0** Exponential backoff.
- **FS-906 P0** Permanent error classification.
- **FS-907 P0** Manual retry.
- **FS-908 P0** Foreground/reconnect triggers.
- **FS-909 P0** Idempotency tests.
- **FS-910 P0** Version conflict detection.
- **FS-911 P0** Conflict review UI.
- **FS-912 P0** Conflict resolution audit.
- **FS-913 P0** Sync diagnostic screen.
- **FS-914 P0** Offline refresh/reconnect Playwright suite.

---

## EPIC-10 Search and analytics

- **FS-1001 P1** Local search index.
- **FS-1002 P1** Global search UI.
- **FS-1003 P1** Structured filters.
- **FS-1004 P1** Category analytics.
- **FS-1005 P1** Member contribution analytics.
- **FS-1006 P1** Monthly trend.
- **FS-1007 P1** Debt ageing.
- **FS-1008 P1** Accessible chart summaries.
- **FS-1009 P1** Analytics reconciliation tests.
- **FS-1010 P1** Large-data performance fixture.

---

## EPIC-11 Budgets and recurring

- **FS-1101 P1** Budget model/repository.
- **FS-1102 P1** Budget setup UI.
- **FS-1103 P1** Budget progress engine.
- **FS-1104 P1** Threshold warnings.
- **FS-1105 P1** Recurring template schema.
- **FS-1106 P1** Recurrence date engine.
- **FS-1107 P1** Stable occurrence keys.
- **FS-1108 P1** Due-occurrence review.
- **FS-1109 P1** Auto-create mode.
- **FS-1110 P1** Cross-device duplicate tests.

---

## EPIC-12 Multi-currency

- **FS-1201 P1** Separate currency balances.
- **FS-1202 P1** Manual rate management.
- **FS-1203 P1** Conversion display.
- **FS-1204 P1** Rate timestamp/source labels.
- **FS-1205 P2** Optional public rate adapter.
- **FS-1206 P1** Decimal-safe rate tests.
- **FS-1207 P1** Cross-currency settlement warnings.

---

## EPIC-13 Receipts

- **FS-1301 P1** File picker/camera input.
- **FS-1302 P1** Image validation.
- **FS-1303 P1** Client compression.
- **FS-1304 P1** Storage repository.
- **FS-1305 P1** Storage rules/tests.
- **FS-1306 P1** Offline attachment queue.
- **FS-1307 P1** Upload progress/retry.
- **FS-1308 P2** Lazy-load browser OCR.
- **FS-1309 P2** OCR correction interface.
- **FS-1310 P2** Itemised expense editor.
- **FS-1311 P2** Tax/tip/discount allocation.
- **FS-1312 P1** Attachment cleanup.

---

## EPIC-14 Data portability

- **FS-1401 P1** Versioned JSON export.
- **FS-1402 P1** CSV export.
- **FS-1403 P1** Import schema validation.
- **FS-1404 P1** Import preview.
- **FS-1405 P1** Duplicate handling.
- **FS-1406 P1** Account deletion flow.
- **FS-1407 P1** Device cache management.

---

## EPIC-15 Production quality

- **FS-1501 P0** Lighthouse optimization.
- **FS-1502 P0** Accessibility audit.
- **FS-1503 P0** Browser matrix.
- **FS-1504 P0** Security review.
- **FS-1505 P0** Rules audit.
- **FS-1506 P0** Dependency audit.
- **FS-1507 P0** Error monitoring decision.
- **FS-1508 P0** Privacy policy.
- **FS-1509 P0** Terms/disclaimer.
- **FS-1510 P0** Deployment rollback test.
- **FS-1511 P0** Final browser checklist.
- **FS-1512 P0** Tag release candidate.

---

## Universal acceptance checklist for every task

- online state tested;
- offline state considered;
- loading/skeleton state present;
- empty state present where applicable;
- errors are user-friendly;
- permissions enforced;
- responsive;
- keyboard accessible;
- tests added;
- documentation updated;
- no production console errors.
