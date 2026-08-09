# FairTab — Product Requirements Document (PRD)

**Version:** 1.0  
**Status:** Build blueprint  
**Product type:** Offline-first collaborative expense-sharing Progressive Web App  
**Primary deployment:** GitHub Pages  
**Backend services:** Firebase Authentication, Cloud Firestore, optional Cloud Storage  
**Working name:** FairTab

---

## 1. Product vision

FairTab is a modern, premium-quality expense-sharing application for friends, roommates, couples, families, events, and travel groups. It combines advanced split methods, debt simplification, analytics, receipt itemisation, recurring expenses, multi-currency support, offline operation, and real-time collaboration without artificially restricting essential features behind a paid plan.

The application must feel like a polished fintech product: dark, minimal, gradient-based, responsive, accessible, and enhanced by controlled glassmorphism. It must remain useful during poor or absent connectivity and synchronize safely when connectivity returns.

FairTab is inspired by the general category of shared-expense applications, but all implementation, branding, layouts, algorithms, copy, and assets must be original.

---

## 2. Problem statement

Existing expense-sharing workflows often create friction because:

- people forget who paid;
- groups use spreadsheets or chat messages;
- unequal and itemised splits are cumbersome;
- balances become difficult to understand;
- users cannot always access advanced analytics or receipt tools;
- connectivity may be unreliable during travel;
- users need trustworthy synchronization and clear conflict handling;
- existing interfaces may not explain how a simplified settlement was derived.

FairTab solves these problems through a local-first financial ledger with collaborative cloud synchronization and explainable calculations.

---

## 3. Product goals

1. Let users create and manage shared expenses quickly.
2. Support equal, exact, percentage, shares, weighted, and itemised splits.
3. Calculate reliable group balances from immutable financial events.
4. Minimise settlement transactions while retaining explainability.
5. Work after first load without an internet connection.
6. Allow safe offline creation and editing with visible sync states.
7. Synchronize group data across authenticated users in real time.
8. Provide premium analytics, recurring bills, search, budgets, and receipt workflows.
9. Deliver a polished dark glassmorphism interface with proper skeletons, loaders, empty states, and errors.
10. Deploy automatically from GitHub to GitHub Pages.

---

## 4. Non-goals for the first production release

- Acting as a bank, wallet, payment processor, or money transmitter.
- Holding user funds.
- Automatically initiating UPI or bank transfers.
- Providing tax, legal, accounting, or investment advice.
- Server-side AI requiring hidden credentials.
- Guaranteed receipt OCR accuracy.
- Full enterprise accounting or double-entry bookkeeping.
- Native iOS or Android applications.
- Anonymous public groups without access control.

---

## 5. Target users

### 5.1 Primary personas

**Roommate**
- Splits rent, utilities, groceries, and subscriptions.
- Needs recurring expenses, budgets, and unequal weights.

**Trip organiser**
- Manages many expenses, currencies, receipts, and settlements.
- Needs offline access and item-level splitting.

**Friend-group coordinator**
- Records dinners, events, gifts, and reimbursements.
- Needs fast entry and simplified settlement suggestions.

**Couple or family**
- Tracks shared versus personal spending.
- Needs percentage or income-weighted splits and analytics.

### 5.2 Administrator persona

A group owner or admin can:
- change group settings;
- invite or remove members;
- assign permitted roles;
- archive the group;
- control simplification and currency preferences.

---

## 6. Core product principles

- **Ledger first:** expenses and settlements are authoritative events.
- **Offline first:** local interaction must not block on the network.
- **Explainability:** every balance and settlement can be traced to source records.
- **Least privilege:** access is granted only to group members.
- **No silent loss:** conflicts, failed writes, and unsynced attachments are visible.
- **Fast perception:** use cached shells, local data, optimistic updates, and skeletons.
- **Original design:** no copied branding, visual assets, proprietary code, or paywall bypass.
- **Accessible premium UI:** aesthetics never reduce contrast or usability.

---

## 7. Functional requirements

### FR-01 Authentication

Users shall be able to:
- register with email and password;
- sign in with email/password;
- sign in with Google;
- verify email;
- reset password;
- sign out;
- manage display name and avatar;
- choose whether persistent offline data is retained on the device.

Acceptance criteria:
- protected routes are inaccessible without an authenticated session;
- auth errors are converted into user-friendly messages;
- signing out can optionally clear local financial caches;
- no Firebase Admin credentials are shipped to the browser.

### FR-02 Dashboard

The dashboard shall show:
- net balance;
- amount owed to user;
- amount user owes;
- active groups;
- pending settlements;
- recent activity;
- category spending;
- monthly trend;
- unsynced operation count;
- offline/sync state.

### FR-03 Groups

Users shall be able to:
- create a group;
- select type: trip, home, couple, event, project, other;
- choose base currency;
- invite registered users;
- add non-account placeholder members;
- assign owner/admin/member/viewer roles;
- archive or leave a group;
- view group balances and activity.

### FR-04 Expenses

Expense fields:
- title;
- optional description;
- group;
- amount in minor currency units;
- currency;
- date and optional time;
- category;
- payer allocation;
- participant allocation;
- split method;
- tags;
- receipt/attachment;
- notes;
- creation and update metadata.

Actions:
- create;
- edit;
- duplicate;
- soft delete;
- restore within undo window;
- permanently remove according to retention policy;
- view change history.

### FR-05 Split methods

Supported methods:
1. Equal
2. Exact amounts
3. Percentages
4. Shares
5. Weighted/custom ratio
6. Itemised receipt
7. Participation-based exclusion
8. Multi-payer expense

Validation:
- payer amounts must sum to total;
- participant shares must sum to total;
- percentages must sum to 100 within defined precision;
- no negative allocations;
- rounding differences must be assigned deterministically;
- zero-decimal and three-decimal currencies must be supported through currency metadata.

### FR-06 Balances

Balances shall be computed from expenses and settlements, not manually edited.

For each member:
- paid total;
- allocated share;
- settlements sent;
- settlements received;
- net position.

The UI shall provide a trace view explaining each total.

### FR-07 Settlements

Users shall be able to:
- record full or partial settlements;
- choose source and destination member;
- record method: cash, UPI, bank, card reimbursement, other;
- add reference and date;
- undo or correct a settlement;
- see a suggested settlement plan.

### FR-08 Debt simplification

The engine shall:
- preserve each member’s net balance;
- reduce the number of transfers;
- avoid self-transfers;
- support minimum-transfer mode;
- support “preserve direct relationships” mode;
- support excluded counterparties;
- provide an explanation of original and simplified states;
- avoid cross-currency simplification unless conversion is explicitly enabled.

### FR-09 Search and filters

Search by:
- expense title;
- merchant;
- notes;
- member;
- group;
- category;
- tag;
- currency;
- date range;
- amount range;
- receipt presence;
- recurring status;
- sync status.

### FR-10 Analytics and budgets

Analytics:
- category breakdown;
- spending by member;
- payer contribution;
- monthly/weekly trend;
- largest expenses;
- most frequent payer;
- debt ageing;
- budget versus actual;
- personal versus shared expenditure.

Budgets:
- group or category budget;
- date period;
- warning thresholds;
- offline-capable progress calculation.

### FR-11 Recurring expenses

Users shall be able to define:
- daily, weekly, monthly, yearly, or custom recurrence;
- start/end dates;
- default participants and split;
- reminder lead time;
- auto-create versus review-before-create.

Because GitHub Pages cannot run scheduled server jobs, due occurrences shall be generated on application open, foreground, or synchronization. Cloud Functions may be introduced later as an optional enhancement.

### FR-12 Multi-currency

- retain original transaction currency and amount;
- group balances by currency by default;
- support optional display conversion;
- store exchange-rate source, value, and timestamp;
- permit manual rate entry;
- do not rewrite historical original amounts;
- show estimated/conversion labels clearly.

### FR-13 Receipt and itemisation

- attach image/PDF subject to supported limits;
- compress images in the browser;
- store pending attachments locally when offline;
- upload when online;
- optional browser OCR;
- allow manual correction;
- distribute tax, service charges, discounts, and tips;
- verify final item allocation against expense total.

### FR-14 Activity and audit history

Record:
- expense created/edited/deleted/restored;
- settlement created/edited;
- member invited/joined/removed;
- role changed;
- group settings changed;
- sync conflict resolved.

Sensitive records should be append-only where practical.

### FR-15 Notifications

In-app notifications:
- invitation;
- expense added;
- expense changed;
- settlement request;
- recurring bill due;
- sync failed;
- conflict needs review.

Web push is optional and not required for the initial release.

### FR-16 Data portability and deletion

- export group data as JSON;
- export transactions as CSV;
- import validated FairTab backup;
- reject incompatible or malicious payloads;
- allow user account deletion;
- document consequences for shared group records;
- allow device cache clearing.

### FR-17 Offline-first operation

After first successful load:
- app shell opens offline;
- previously synced groups and transactions are available;
- supported writes work offline;
- balances and analytics calculate locally;
- operations display queued/syncing/failed/synced state;
- attachments remain local until upload;
- synchronization retries on open, reconnect, foreground, and manual retry;
- conflicts are surfaced rather than silently discarded.

### FR-18 PWA

- installable manifest;
- service worker;
- offline fallback;
- icons including maskable icon;
- update-available prompt;
- standalone display;
- responsive safe-area support.

---

## 8. UX and design requirements

### 8.1 Visual style

- default dark theme;
- deep charcoal/midnight background;
- restrained indigo/violet/cyan gradients;
- controlled glassmorphism;
- soft 1px translucent borders;
- semantic green/amber/rose;
- minimal visual noise;
- tabular financial numerals;
- consistent 8px spacing system;
- responsive desktop sidebar and mobile bottom navigation.

### 8.2 Glassmorphism rules

Use glass on:
- sidebar/header;
- major summary cards;
- modal/bottom sheet;
- command palette;
- floating controls;
- toast surfaces.

Avoid heavy blur on:
- long lists;
- tables;
- nested inputs;
- every small card.

Provide fallback opaque surfaces when `backdrop-filter` is unavailable.

### 8.3 Loading states

Must include:
- app bootstrap loader;
- route-level skeleton;
- dashboard skeleton;
- group-card skeleton;
- expense-row skeleton;
- chart skeleton;
- avatar skeleton;
- button spinner;
- inline pending state;
- full-page blocking loader only when strictly required.

Skeleton dimensions must match final layout to reduce cumulative layout shift.

### 8.4 Motion

- 150–250 ms transitions;
- transform and opacity preferred;
- reduced-motion mode;
- no distracting looping animation;
- no animation that blocks data entry.

### 8.5 Accessibility

Target WCAG 2.2 AA:
- keyboard operability;
- visible focus;
- semantic headings and landmarks;
- labelled controls;
- adequate contrast;
- screen-reader announcements for errors, saves, sync status, and toasts;
- no colour-only meaning;
- 44px touch targets where practical.

---

## 9. Performance requirements

Initial production targets:
- Lighthouse Performance: >= 90 on representative mobile run;
- Accessibility: >= 95;
- Best Practices: >= 95;
- SEO: >= 90 for public shell;
- first meaningful cached render: under 1.5s on typical repeat visit;
- no blocking full collection reads;
- paginated or cursor-based transaction history;
- route-level code splitting;
- compressed images;
- bundle warnings over 500 KB per chunk;
- avoid unnecessary Firestore listeners.

---

## 10. Security and privacy requirements

- deny-by-default Firestore and Storage rules;
- authenticated access only;
- group membership checked server-side by rules;
- owner/admin-only privileged changes;
- user cannot grant own role;
- validate allowed fields and types;
- validate attachment type and size;
- use Firebase App Check if compatible with production deployment;
- no service-account keys in repository;
- no secret third-party keys in frontend;
- sanitize imported data;
- use Content Security Policy where feasible;
- log security-sensitive changes;
- test rules in Firebase Emulator Suite.

---

## 11. Success metrics

Product:
- median expense creation time under 45 seconds;
- >= 95% successful supported offline operation replay;
- zero unexplained balance mismatch in automated property tests;
- >= 99% successful sync after recoverable network interruption;
- user can reach source transactions from any displayed balance.

Engineering:
- all critical flows covered by end-to-end tests;
- Firestore rules test suite passes;
- no high/critical dependency vulnerabilities;
- deployment reproducible from main branch;
- browser checklist passes on target platforms.

---

## 12. Release scope

### MVP
Authentication, profile, groups, members, core expense splits, balances, settlements, debt simplification, offline cache, queued writes, JSON export, responsive premium UI, GitHub Pages deployment.

### V1
Invitations, roles, activity history, recurring expenses, budgets, search, analytics, multi-currency display conversion, attachment upload.

### V1.5
Receipt OCR/itemisation, advanced conflict UI, scenario simulator, anomaly detection, richer reports, optional push notifications.

---

## 13. Key assumptions and constraints

- GitHub Pages hosts only static assets.
- Firebase provides identity and data services.
- Firebase web configuration is public; authorization depends on Security Rules.
- Offline Firestore synchronization may use last-write-wins for the same document, so financial editing requires explicit application-level versioning and conflict handling.
- Cloud Storage availability and cost depend on the Firebase project plan and current pricing.
- Recurring entries cannot be generated on a guaranteed schedule without an external scheduled backend.
- The app is not a payment processor.

---

## 14. Definition of done

A feature is done only when:
- functionality meets acceptance criteria;
- offline and online states are tested;
- loading, empty, error, and permission-denied states exist;
- responsive layouts pass;
- keyboard and screen-reader basics pass;
- security rules permit only intended access;
- unit/integration/end-to-end tests pass;
- documentation is updated;
- no console errors occur in production build.
