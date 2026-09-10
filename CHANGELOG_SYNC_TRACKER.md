# FairTab Master (Web) Change Log & Sync Tracker

> **Purpose**: Authoritative log of all modifications made to the master web project (`FairTab`). Used to cross-reference and synchronize changes to the Android App folder (`Android Studio/FairTab Playstore App`).

---

## Change Log

### [2026-09-11] - Mobile Responsive Layout, Light Mode Contrast & Navigation Clearance Fixes
- **Scope**: `UI / Mobile Optimization / Styling / Layout / Accessibility`
- **Files Changed**:
  - `src/components/layout/QuickCalculator.tsx` (Fixed light mode keypad numbers, presets, and action buttons using theme tokens instead of hardcoded white text)
  - `src/features/groups/GroupsPage.tsx` (Fixed group cards and icon containers using `bg-surface-primary` and `border-border-color` with high-contrast hover effects in light and dark modes)
  - `src/features/insights/InsightCard.tsx` (Fixed code reason string overflow with responsive truncation, preventing collision with "Explain Metrics", and improved light/dark badge contrast)
  - `src/features/analytics/HistoricalLedgerAndBalanceSection.tsx` (Added horizontal scroll container to tab navigation and minimum table column widths so tables never squash on mobile devices)
  - `src/components/layout/AppShell.tsx` & `src/components/layout/PageContainer.tsx` (Increased mobile bottom padding to `pb-[110px]` / `pb-20` so the floating mobile navigation bar never covers bottom content or action buttons)
- **Sync Status**: `Synced to Web & Android` (169 Vitest tests passing, deployed live to Firebase Hosting, synced via `npm run build:mobile`)

### [2026-09-11] - Animated 404 Page & Global Error Boundary with Working Retry
- **Scope**: `UI / Feedback / Error Handling / Routing / PWA`
- **Files Changed**:
  - `src/components/feedback/Animated404ErrorView.tsx` (Created responsive, mobile-optimized animated 404 / error view featuring the animated character walking canvas, large header, error details collapsible trace, and interactive "Try Again", "Return to Dashboard", and "Back" buttons)
  - `src/features/error/NotFoundPage.tsx` (Replaced plain placeholder with `Animated404ErrorView` for unknown route fallbacks)
  - `src/components/feedback/ErrorBoundary.tsx` (Integrated `Animated404ErrorView` with custom error trace toggle and component error state reset)
  - `src/App.tsx` (Wrapped top-level `<Routes>` in `<ErrorBoundary>` and added catch-all outer 404 route for unauthenticated paths)
  - `public/offline.html` (Updated offline service worker fallback to use animated 404 canvas and retry button)
  - `public/images/404-bg.gif` & `src/assets/404-bg.gif` (Integrated animated asset into bundle)
- **Sync Status**: `Synced to Web & Android` (169 Vitest tests passing, deployed live to Firebase Hosting, synced via `npm run build:mobile`)

### [2026-09-11] - Analytics & Insights Historical Ledgers & Past Balance Summary Records
- **Scope**: `UI / Analytics / Insights / Ledgers / Balances`
- **Files Changed**:
  - `src/features/analytics/HistoricalLedgerAndBalanceSection.tsx` (Created comprehensive component with 3 interactive tabs: **Balance Summary** per-member cards with net balances, total paid, total share consumed, and pairwise debt breakdowns; **Expenses Ledger** full searchable/filterable table of expenses with timestamps, category chips, splits, and statuses; and **Settlements Ledger** table detailing past settlements with transfers, dates, amounts, and statuses)
  - `src/features/analytics/AnalyticsPage.tsx` (Embedded HistoricalLedgerAndBalanceSection at the bottom of the analytics dashboard)
  - `src/features/insights/SmartInsightsPage.tsx` (Embedded HistoricalLedgerAndBalanceSection at the bottom of the smart insights dashboard)
- **Sync Status**: `Synced to Web & Android` (Compiled with TypeScript/Vite, synced to Android via `npm run build:mobile`, and deployed to Firebase Hosting)

### [2026-09-10] - Group Data Export Permission Fix & Scoped Single-Group Exports
- **Scope**: `Logic / Security / UI / Export`
- **Files Changed**:
  - `src/utils/exportHelper.ts` (Replaced root collection queries on `/users` and `/groups` with secure direct document reads on `/users/{uid}`, `/userGroupIndex/{uid}/groups`, and individual group subcollections; added `fetchGroupExportData` for fast single-group backup/CSV generation; fixed `receiverId` mapping in settlements CSV)
  - `src/features/groups/GroupSettingsPage.tsx` (Connected JSON, Expenses CSV, Splits CSV, and Settlements CSV export handlers directly to `fetchGroupExportData`)
- **Sync Status**: `Synced to Web & Deployed` (Verified with ESLint, Vitest, and deployed live to Firebase Hosting)

### [2026-09-10] - Dashboard Gross Debt & Credit Totals Calculation Parity
- **Scope**: `Logic / UI / Calculations`
- **Files Changed**:
  - `src/features/dashboard/OverviewPage.tsx` (Aggregated `totalOwedMinor` and `totalOwesMinor` directly from bilateral debt recommendations rather than net balance sign checks so "You are owed total" and "You owe total" reflect exact gross amounts; updated suggested settlement calculation to resolve member IDs and respect group strategy)
  - `src/features/settlements/GlobalSettlementsPage.tsx` (Updated global currency summary to accumulate pairwise debts and credits according to each group's `settlementStrategy`)
- **Sync Status**: `Synced to Web & Deployed` (169 Vitest tests passing, deployed live to Firebase Hosting)

### [2026-09-10] - Debt Tracking Simplification Strategy (Preserve Relationships vs Minimum Transactions)
- **Scope**: `Logic / Domain / UI / Settings`
- **Files Changed**:
  - `packages/domain/src/expenses/groupSchema.ts` & `src/features/groups/CreateGroupPage.tsx` (Defaulted `settlementStrategy` to `preserve_relationships`)
  - `src/features/groups/GroupSettingsPage.tsx` (Added Balance Calculation strategy selector with clear explanations)
  - `src/features/settlements/components/DebtSimplificationPanel.tsx` & `SettlementsPage.tsx` (Added interactive sync toggle buttons in Debt Optimization Plan banner)
  - `packages/domain/src/expenses/balances.ts` & `simplification.ts` (Ensured non-voided active expenses are properly calculated)
- **Sync Status**: `Synced to Web & Deployed` (Deployed live to Firebase Hosting)

### [2026-09-10] - Outbox Sync Error Visibility & Immediate Recovery Fix
- **Scope**: `Logic / Offline / UI / Sync`
- **Files Changed**:
  - `src/features/expenses/ExpenseListPage.tsx` (Expanded `refreshFailedOps` outbox listener to extract error messages from all pending retry operations and receipt drafts, rendering the precise rejection/network error reason directly in the sync banner alongside one-click "Clear Queue" and "Retry Sync" actions)
- **Sync Status**: `Synced to Android` (Compiled web bundle synced to Android assets and verified with `npm run build:mobile`)

### [2026-09-10] - Onboarding Setup Resilience & Invite Link Creation Fallback
- **Scope**: `Logic / UI / Profile / Invitations`
- **Files Changed**:
  - `src/infrastructure/firebase/profileService.ts` (Added transactional Firestore client-side fallback to `updateUserProfile` to guarantee onboarding "Complete Setup" never blocks or fails during serverless cold starts)
  - `src/features/groups/InviteMemberDialog.tsx` (Added client-side cryptographic token generation fallback for global invite link creation)
  - `src/features/invitations/InvitationAcceptPage.tsx` (Prioritized direct client Firestore lookup `/globalInviteLinks/{tokenHash}` before serverless API fallback, preventing CORS/cold-start errors; improved auth state loading handling)
  - `src/features/auth/LoginForm.tsx` & `RegisterForm.tsx` (Preserved `redirect` parameter and pending invite tokens upon successful login/registration so users are returned directly to their invite acceptance screen instead of default `/overview`)
- **Sync Status**: `Synced to Android` (Compiled bundle synced via `sync-web-assets.js` and Capacitor public assets updated)

### [2026-09-10] - Immediate Firestore Invite Resolution & Auth Redirection Bridge
- **Scope**: `Logic / UI / Routing / Auth`
- **Files Changed**:
  - `src/features/invitations/InvitationAcceptPage.tsx` (Prioritized direct client Firestore lookup `/globalInviteLinks/{tokenHash}` before serverless API fallback, preventing CORS/cold-start errors; improved auth state loading handling)
  - `src/features/auth/LoginForm.tsx` & `RegisterForm.tsx` (Preserved `redirect` parameter and pending invite tokens upon successful login/registration so users are returned directly to their invite acceptance screen instead of default `/overview`)
- **Sync Status**: `Synced to Android` (Compiled bundle synced via `sync-web-assets.js` and Capacitor public assets updated)

### [2026-09-10] - Forced Canonical Firebase Hosting URL & Cloud Functions Invite Fix
- **Scope**: `Logic / Config / API`
- **Files Changed**:
  - `src/utils/urlHelper.ts` (Forced `getPublicAppBaseUrl()` to unconditionally return canonical `https://fairtab-48340.web.app` for invite links across web, mobile, and custom domain sessions)
  - `functions/src/invitationOperations.ts` (Updated email invitation fallback URL to `https://fairtab-48340.web.app/#/invite/<token>`)
  - `api/_lib/middleware.ts` (Added `https://fairtab-48340.web.app` and `https://fairtab-48340.firebaseapp.com` to allowed CORS origins)
- **Sync Status**: `Synced to Android` (Compiled bundle synced via `sync-web-assets.js` and Capacitor public assets updated)

### [2026-09-09] - Firebase Hosting Deployment & Standalone Invitation Landing Fix
- **Scope**: `Config / Hosting / UI / Logic`
- **Files Changed**:
  - `.env.production` (Updated `VITE_APP_BASE_PATH=/` for Firebase root hosting)
  - `vite.config.ts` (Updated default base path to `/` and manifest start URL)
  - `index.html` (Updated icon links to root `/icons/icon-192.png`)
  - `scripts/verify-paths.js` (Updated postbuild verification for root base path `/`)
  - `src/features/invitations/InvitationAcceptPage.tsx` (Integrated `useAuth()` to smoothly resolve unauthenticated state without hanging in `isLoading` and wrapped in `AuthLayout` for pristine standalone presentation)
- **Sync Status**: `Synced to Android` (Tested and verified live with Chrome on Pixel 8 Pro emulator)

### [2026-09-09] - Firebase Hosting Domain Migration for App & Group Invite Links
- **Scope**: `Config / Logic / Hosting`
- **Files Changed**:
  - `.firebaserc` (Updated default Firebase project ID to `fairtab-48340`)
  - `firebase.json` (Added Firebase Hosting configuration pointing to `dist` directory with SPA rewrite rules)
  - `src/utils/urlHelper.ts` (Updated canonical public base URL from `https://rohitpvt.github.io/FairTab` to `https://fairtab-48340.web.app`)
- **Sync Status**: `Synced to Android` (Tested and verified live on Pixel 8 Pro emulator)

### [2026-09-09] - Instant Onboarding & Disabled Email Verification Gate
- **Scope**: `Logic / Config / Auth`
- **Files Changed**:
  - `.env`, `.env.production` (Set `VITE_REQUIRE_EMAIL_VERIFICATION=false` allowing unlimited free user signups without SMS/email OTP rate limits)
  - `src/features/auth/RegisterForm.tsx` (Conditionally bypass `sendVerificationEmail` when verification is disabled, showing direct welcome toast and transitioning immediately to onboarding / dashboard)
- **Sync Status**: `Synced to Android` (Tested and verified live on Pixel 8 Pro emulator)

### [2026-09-09] - Descending Debt & Balance Sort Order
- **Scope**: `UI / Logic`
- **Files Changed**:
  - `src/components/dashboard/PersonalDebtSummaryCard.tsx` (Sorted "Owed to you" and "You owe" arrays descending by total amount, and sub-group breakdowns descending by amount)
  - `src/features/expenses/BalanceProjectionCard.tsx` (Sorted group members descending by net balance)
  - `src/features/settlements/components/DebtSimplificationPanel.tsx` (Sorted debt optimization recommendations descending by amount)
  - `src/features/settlements/GlobalSettlementsPage.tsx` (Sorted global suggested settlements descending by amount)
- **Sync Status**: `Synced to Android` (Compiled bundle synced via `sync-web-assets.js` and Capacitor public assets updated)


### [2026-09-09] - Exact Split Zero-Amount Member Filtering & Outbox Validation Fix
- **Scope**: `Logic / Bug Fix`
- **Files Changed**:
  - `src/features/expenses/ExpenseForm.tsx` (Filtered out 0-amount member allocations from `splits` and derived `participantIds` strictly from non-zero split members to comply with backend positive-integer requirement)
- **Sync Status**: `Synced to Android` (Compiled bundle synced via `sync-web-assets.js` and Capacitor public assets updated)


### [2026-09-09] - Multi-Group Settlement Navigation & Link Accessibility
- **Scope**: `UI / Feature / Bug Fix`
- **Files Changed**:
  - `src/components/dashboard/PersonalDebtSummaryCard.tsx` (Added direct group-specific settlement links/chevrons next to each group row in multi-group breakdowns so users can navigate to settlements directly for multi-group debts)
- **Sync Status**: `Synced to Android` (Compiled bundle synced via `sync-web-assets.js` and Capacitor public assets updated)

### [2026-09-09] - Fix Multi-Group Money Amount Right-Alignment
- **Scope**: `UI / Bug Fix`
- **Files Changed**:
  - `src/components/dashboard/PersonalDebtSummaryCard.tsx` (Removed asymmetric `pr-2` padding from multi-group breakdown container and added `financial-number` tabular numbers so sub-group amounts align in a perfect vertical line with the card headers)
- **Sync Status**: `Synced to Android` (Compiled bundle synced via `sync-web-assets.js` and Capacitor public assets updated)

### [2026-09-09] - Split Engine Math Parity & Outbox Recovery
- **Scope**: `Logic / Bug Fix`
- **Files Changed**:
  - `src/features/expenses/ExpenseForm.tsx` (Migrated client split calculations to `@fairtab/domain` split functions: `splitEqual`, `splitExact`, `splitPercentage`, `splitShares` for exact cloud parity)
  - `src/infrastructure/offline/syncManager.ts` (Added unconditional Dexie outbox purge in `clearFailedOperations`)
  - `src/features/groups/GroupDetailPage.tsx` (Added "Dismiss Failed" action and clear failure reasons)
  - `src/features/expenses/ExpenseListPage.tsx` (Added "Dismiss Failed" action and clear failure reasons)
  - `src/components/dashboard/PersonalDebtSummaryCard.tsx` (Implemented multi-group per-person balance aggregation on Overview Dashboard)
- **Sync Status**: `Synced to Android` (97/97 files compiled, bundle copied, Capacitor assets synced, verified on physical device `J7DEGIFIT86X5XCQ`)

---

## Log Template for Future Entries
```markdown
### [YYYY-MM-DD] - <Brief Title>
- **Scope**: `UI / Logic / Feature / Bug Fix`
- **Files Changed**:
  - `<path/to/file1>` (<Brief description of changes>)
  - `<path/to/file2>` (<Brief description of changes>)
- **Sync Status**: `Synced to Android / Pending Sync / Native Only` (<Details or notes>)
```
