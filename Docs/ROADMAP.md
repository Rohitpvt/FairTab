# FairTab — Product and Engineering Roadmap

**Current Status:** All Phase 0 through Phase 10 engineering deliverables have been fully implemented, tested (via Vitest, Firestore Security Rules, and Playwright E2E tests), and successfully integrated.

## Guiding rule

Each phase must end in a deployable, testable increment. Do not postpone security, loading states, offline behavior, or responsive design until the end.

---

## [COMPLETED] Phase 0 — Discovery and foundation

Deliverables:
- freeze product scope;
- select final name and repository name;
- establish design tokens and component principles;
- create Firebase development project;
- create GitHub repository;
- configure CI;
- write architecture decision records;
- create threat model;
- define currency and rounding rules.

Exit criteria:
- all blueprint documents accepted;
- local development runs;
- CI build passes;
- Firebase Emulator Suite starts;
- empty GitHub Pages shell deploys.

---

## [COMPLETED] Phase 1 — Application shell and premium design system

Features:
- responsive app shell;
- sidebar and mobile navigation;
- dark gradient background;
- glass surfaces;
- typography;
- buttons, inputs, dialogs, bottom sheets;
- skeletons;
- empty/error states;
- toast system;
- reduced-motion support;
- route loading.

Exit criteria:
- Storybook or internal component gallery;
- mobile and desktop layouts pass;
- accessibility baseline;
- no major layout shifts.

---

## [COMPLETED] Phase 2 — Authentication and onboarding

Features:
- email registration/login;
- Google sign-in;
- verification/reset;
- protected routes;
- profile;
- trusted-device offline consent;
- onboarding;
- sign-out cache options.

Exit criteria:
- emulator and production dev project auth tested;
- errors normalized;
- unauthorized routes blocked;
- account-specific cache isolation works.

---

## [COMPLETED] Phase 3 — Groups and membership

Features:
- create/edit/archive group;
- group list;
- account and placeholder members;
- roles;
- invitations;
- member removal/leave;
- group activity basics.

Exit criteria:
- rules prevent unauthorized access and role escalation;
- group appears across two authenticated test users;
- offline-created group syncs once.

---

## [COMPLETED] Phase 4 — Core expense engine

Features:
- equal split;
- exact split;
- percentage;
- shares;
- weighted;
- multi-payer;
- expense detail/edit/delete/undo;
- category and tags;
- deterministic money rounding.

Exit criteria:
- property tests pass;
- allocation sums always reconcile;
- offline create/edit persists through refresh;
- no duplicate after reconnect.

---

## [COMPLETED] Phase 5 — Balances and settlements

Features:
- ledger-derived balances;
- trace/explanation;
- record settlement;
- partial settlement;
- reversal;
- simplified settlement suggestions;
- group settled state.

Exit criteria:
- per-currency net sum is zero;
- suggested plan preserves net balances;
- cross-check against hand-calculated fixtures;
- audit events present.

---

## [COMPLETED] Phase 6 — Offline-first synchronization hardening

Features:
- custom IndexedDB outbox;
- sync manager;
- retry/backoff;
- pending status UI;
- conflict detection and resolution;
- app foreground/reconnect synchronization;
- service-worker update prompt;
- diagnostic screen.

Exit criteria:
- offline/reload/reconnect E2E passes;
- simultaneous edit conflict is visible;
- permanent permission failures stop retrying;
- pending work survives tab close.

---

## [COMPLETED] Phase 7 — Search, analytics, and budgets

Features:
- indexed local search;
- structured filters;
- spending trends;
- category/member analytics;
- budget setup and progress;
- lazy-loaded charts;
- accessible chart summaries.

Exit criteria:
- large fixture dataset remains responsive;
- analytics reconcile with ledger;
- search works offline for cached records.

---

## [COMPLETED] Phase 8 — Recurring expenses and multi-currency

Features:
- recurrence templates;
- deterministic occurrence generation;
- review/auto-create modes;
- currency-separated balances;
- manual rates;
- optional online rate provider;
- converted display analytics.

Exit criteria:
- no duplicate occurrences across devices/restarts;
- original values never changed by conversion;
- stale rates clearly labelled.

---

## [COMPLETED] Phase 9 — Receipts and itemisation

Features:
- upload/camera input;
- client compression;
- offline pending attachment;
- Storage upload;
- browser OCR;
- item editor;
- item assignment;
- tax/tip/discount allocation.

Exit criteria:
- upload rules validated;
- unsupported files rejected;
- offline attachment sync works;
- manual correction always possible;
- total reconciliation enforced.

---

## [COMPLETED] Phase 10 — Production hardening

Activities:
- complete rules test suite;
- threat-model review;
- browser matrix;
- Lighthouse;
- accessibility audit;
- quota and cost review;
- privacy policy;
- terms;
- account deletion;
- backup/import validation;
- error monitoring;
- custom domain optional.

Exit criteria:
- final browser checklist passed;
- release candidate tagged;
- rollback tested;
- documentation current.

---

## Post-V1 opportunities

- scenario simulator;
- anomaly/duplicate detection;
- household income-weighted rules;
- exportable PDF reports;
- optional Cloud Functions for scheduled tasks;
- push notifications;
- passkeys;
- encrypted shared backup;
- payment-link handoff without processing funds;
- exact optimisation solver for constrained settlements;
- native wrappers only after PWA maturity.

---

## Scope control

A feature may enter a phase only when:
- dependencies are complete;
- data model is defined;
- security impact is reviewed;
- offline behavior is specified;
- loading/error/empty states are defined;
- acceptance tests are written.

Do not start OCR, AI, or advanced animation before the ledger and sync engine are stable.
