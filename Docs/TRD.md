# FairTab — Technical Requirements Document (TRD)

## 1. Runtime requirements

### Supported browsers
Initial support:
- latest two stable Chrome versions;
- latest two stable Edge versions;
- latest two stable Firefox versions;
- Safari 17+;
- iOS Safari 17+;
- Android Chrome current.

The app must degrade safely where Background Sync, installation prompts, or `backdrop-filter` are unavailable.

### Node/tooling
- use an actively supported Node.js LTS release;
- pin version in `.nvmrc` or `.node-version`;
- use npm with committed `package-lock.json`;
- CI must use `npm ci`.

Do not hardcode a stale Node version in this blueprint; select current supported LTS at project initialization and document it.

---

## 2. Frontend requirements

- React with TypeScript strict mode.
- Vite production build.
- No TypeScript errors.
- No ESLint errors in CI.
- Route-level lazy loading.
- Error boundaries.
- Form validation with Zod.
- Accessible Radix-based primitives where appropriate.
- CSS variables for design tokens.
- Responsive at 320px through large desktop.
- No horizontal overflow on supported screens.

---

## 3. Design system requirements

### Theme
- dark default;
- optional light theme later;
- theme persisted locally;
- semantic tokens independent of raw colour classes.

### Glassmorphism
- max blur tiers: subtle, standard, elevated;
- mobile blur reduced;
- opaque fallback;
- no nested high-blur panels;
- maintain text contrast.

### Loaders
- skeletons for data regions;
- inline spinners for actions;
- retain button width while loading;
- no indefinite spinner without status or timeout handling;
- `aria-busy` and live announcements where appropriate.

---

## 4. Firebase requirements

### Authentication
- email/password;
- Google provider;
- email verification support;
- password reset;
- auth persistence configured deliberately;
- authorized domains include local and GitHub Pages domains.

### Firestore
- modular SDK;
- persistent local cache;
- cache ownership scoped to authenticated UID;
- collection queries use indexes;
- paginated history;
- real-time listeners unsubscribed on route/group change;
- Security Rules tracked in repository;
- Emulator tests required.

### Storage
- optional until Firebase project plan supports it;
- receipt limit recommended: 5 MB after compression;
- image MIME allowlist;
- PDF optional and separately validated;
- client cannot write outside authorized group/user paths.

---

## 5. Offline requirements

- shell available after first online load;
- cached data rendered offline;
- writes saved locally before success feedback;
- pending changes persist across refresh;
- deterministic replay;
- visible queue state;
- recoverable retries;
- manual retry;
- attachment queue;
- conflict detection;
- no data silently discarded.

Offline test scenarios:
1. open cached group with network disabled;
2. add expense;
3. refresh while still offline;
4. confirm expense remains;
5. restore network;
6. confirm exactly one cloud expense;
7. confirm balances unchanged after sync.

---

## 6. Financial correctness requirements

- integer minor units;
- currency minor digit metadata;
- deterministic rounding;
- payer sum equals amount;
- share sum equals amount;
- no self-settlement;
- net group balance equals zero per currency;
- deleted/reversed records excluded correctly;
- property tests for random allocations;
- display conversion cannot alter source ledger.

---

## 7. Security requirements

- deny by default;
- authenticated reads/writes only;
- group membership enforced by rules;
- role-based mutations;
- no client self-elevation;
- immutable owner except explicit transfer;
- validate types, bounds, and permitted keys;
- rate abuse mitigations where available;
- App Check considered before public launch;
- no Admin SDK credentials in frontend or GitHub repository;
- dependency audit;
- CSP and security headers where GitHub Pages permits via meta/asset strategy;
- sanitize imported data;
- exports require explicit user action.

---

## 8. Performance budgets

Recommended budgets:
- initial JS compressed: target <= 250 KB, warning <= 350 KB;
- route chunk compressed: target <= 150 KB;
- main-thread long tasks minimised;
- no unbounded lists;
- images resized and compressed;
- charts lazy-loaded;
- avoid loading OCR library until requested;
- active Firestore listeners limited to visible contexts.

Core Web Vitals targets:
- LCP <= 2.5s;
- INP <= 200ms;
- CLS <= 0.1.

---

## 9. Reliability requirements

- idempotent mutation replay;
- exponential backoff with jitter;
- distinguish retryable and permanent errors;
- preserve failed payload for correction/export;
- audit sensitive changes;
- handle Firestore quota/permission/network errors;
- service worker update must not destroy unsaved state;
- local database migrations must be transactional or recoverable.

---

## 10. Accessibility requirements

- WCAG 2.2 AA target;
- keyboard navigation;
- focus trap in modal;
- Escape closes dismissible overlays;
- labels and descriptions;
- error summary and field association;
- live regions for sync/action status;
- reduced motion;
- 200% zoom usability;
- contrast checks on glass surfaces;
- charts have textual summaries.

---

## 11. Internationalisation requirements

Initial language: English.

Architecture must support:
- locale-aware currency formatting;
- date/time formatting;
- RTL compatibility where practical;
- externalized UI strings;
- user timezone;
- no concatenated sentence fragments that block translation.

---

## 12. Testing requirements

CI-required:
- lint;
- type check;
- unit tests;
- domain property tests;
- production build;
- Security Rules tests.

Pre-release:
- Playwright E2E;
- offline tests;
- multi-user real-time tests;
- browser matrix;
- Lighthouse;
- accessibility scan;
- manual financial reconciliation.

Coverage targets:
- domain algorithms >= 95%;
- application services >= 80%;
- UI coverage based on risk, not vanity total.

---

## 13. CI/CD requirements

Pull request:
- install;
- lint;
- typecheck;
- test;
- build;
- optional preview artifact.

Main:
- all checks;
- build with production base path;
- upload Pages artifact;
- deploy using GitHub Pages action;
- record deployment URL.

Use protected main branch and required checks.

---

## 14. Repository quality requirements

Required:
- README;
- licence;
- contribution guide if public;
- issue templates;
- environment example;
- architecture docs;
- changelog or release notes;
- no generated `dist` committed unless deployment strategy explicitly requires it;
- conventional or clearly defined commit format.

---

## 15. Environment variables

Example:
```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_APP_BASE_PATH=/FairTab/
```

All `VITE_*` values are embedded in the client bundle and must be treated as public.

Secrets such as service-account JSON must never be added.

---

## 16. Data migration requirements

Every persisted model includes `schemaVersion`.

Migration rules:
- backward compatible reads where possible;
- local IndexedDB migrations tested;
- Firestore migrations scripted and reviewed;
- no destructive migration without backup;
- migration status documented;
- old clients rejected gracefully if incompatible.

---

## 17. Operational limits

- enforce maximum group size in initial release, e.g. 100 members;
- cap expense title/description lengths;
- cap tag count;
- cap payer/participant arrays;
- paginate activity and expense history;
- cap receipt dimensions and size;
- monitor Firebase quotas and GitHub Pages limits.

Limits must be centralized, not scattered constants.

---

## 18. Completion gate

Production readiness requires:
- no critical/high known security issues;
- Firestore and Storage rules deployed and tested;
- offline round-trip passes;
- no balance invariant failures;
- deployment rollback procedure documented;
- privacy and terms pages present for public launch;
- final browser checklist signed off.
