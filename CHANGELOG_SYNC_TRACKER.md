# FairTab Master (Web) Change Log & Sync Tracker

> **Purpose**: Authoritative log of all modifications made to the master web project (`FairTab`). Used to cross-reference and synchronize changes to the Android App folder (`Android Studio/FairTab Playstore App`).

---

## Change Log

### [2026-09-10] - Dual-Layer Resilient Invitation Resolution & Retry UI
- **Scope**: `Logic / UI / Resilience`
- **Files Changed**:
  - `src/features/invitations/InvitationAcceptPage.tsx` (Implemented dual-layer resolution: ensures fresh Firebase ID token before calling backend API, with direct Firestore `/globalInviteLinks/{tokenHash}` fallback; added user-friendly error card with "Retry Link" and "Return to Groups" actions)
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
