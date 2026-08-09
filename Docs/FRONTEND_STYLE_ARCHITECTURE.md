# FairTab — Frontend Styling and Architecture

**File:** `FRONTEND_STYLE_ARCHITECTURE.md`  
**Product:** FairTab  
**Tagline:** Every expense, fairly shared.  
**Status:** Authoritative frontend blueprint  
**Deployment:** GitHub Pages  
**Frontend stack:** React, TypeScript, Vite, Tailwind CSS, Radix UI/shadcn-style primitives, Lucide React, Framer Motion, React Hook Form, Zod, TanStack Query, Zustand, Firebase Web SDK, Dexie, vite-plugin-pwa

---

## 1. Purpose

This document is the source of truth for FairTab’s frontend styling and architecture. Antigravity must follow it when generating code.

It defines:

- visual identity;
- dark-gradient and glassmorphism styling;
- responsive layout;
- reusable components;
- route structure;
- state ownership;
- feature boundaries;
- loading, empty, error, offline, and synchronization states;
- forms and validation;
- accessibility;
- performance;
- testing;
- GitHub Pages and PWA constraints.

Business logic must remain outside React presentation components.

---

# PART I — VISUAL SYSTEM

## 2. Product personality

FairTab should feel:

- trustworthy;
- precise;
- calm;
- premium;
- modern;
- collaborative;
- transparent.

It must not resemble a generic admin template or directly copy Splitwise branding, layouts, assets, wording, or interaction patterns.

---

## 3. Theme strategy

FairTab is dark-first.

The default composition uses:

1. deep charcoal and midnight backgrounds;
2. restrained indigo, violet, and cyan ambient gradients;
3. controlled frosted-glass surfaces;
4. thin translucent borders;
5. crisp high-contrast typography;
6. restrained semantic financial colours.

All components must use semantic design tokens rather than hardcoded colours.

Incorrect:

```tsx
<div className="bg-[#111827] text-[#fff]">
```

Preferred:

```tsx
<div className="bg-surface-primary text-text-primary">
```

---

## 4. Design tokens

Create:

```text
src/styles/tokens.css
```

### 4.1 Colour tokens

```css
:root {
  --color-bg-base: 224 38% 5%;
  --color-bg-deep: 225 35% 7%;

  --color-surface-primary: 224 32% 10%;
  --color-surface-secondary: 222 29% 13%;
  --color-surface-elevated: 222 26% 16%;
  --color-surface-hover: 221 24% 19%;

  --color-text-primary: 220 33% 97%;
  --color-text-secondary: 220 18% 72%;
  --color-text-muted: 221 13% 51%;
  --color-text-disabled: 220 10% 38%;

  --color-accent-indigo: 246 100% 71%;
  --color-accent-violet: 271 91% 65%;
  --color-accent-cyan: 188 86% 53%;

  --color-success: 158 64% 52%;
  --color-warning: 43 96% 56%;
  --color-danger: 350 89% 70%;
  --color-info: 198 93% 60%;
}
```

### 4.2 Financial semantics

- Green: money owed to the current user.
- Rose/red: money the current user owes.
- Amber: pending, unsynced, or unresolved.
- Neutral white: settled or informational.
- Never communicate meaning through colour alone.

### 4.3 Spacing

Use a 4px base and an 8px dominant rhythm.

```text
4, 8, 12, 16, 20, 24, 32, 40, 48, 64px
```

### 4.4 Radius

```css
:root {
  --radius-sm: 0.625rem;
  --radius-md: 0.875rem;
  --radius-lg: 1.125rem;
  --radius-xl: 1.5rem;
  --radius-2xl: 2rem;
  --radius-full: 9999px;
}
```

### 4.5 Motion

```css
:root {
  --duration-fast: 120ms;
  --duration-standard: 180ms;
  --duration-slow: 260ms;
  --ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1);
}
```

---

## 5. Typography

Preferred fonts:

- Inter;
- Geist;
- system fallback.

Recommended stack:

```css
font-family:
  Inter,
  Geist,
  ui-sans-serif,
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

Use tabular numerals for balances, percentages, totals, and chart values:

```css
.financial-number {
  font-variant-numeric: tabular-nums lining-nums;
}
```

Type hierarchy:

```text
Display balance: 36–44px
Page heading: 28–32px
Section heading: 18–22px
Card heading: 15–17px
Body: 14–16px
Supporting text: 13–14px
Label: 11–13px
```

---

## 6. Background system

Use one shared application background:

```css
.app-background {
  min-height: 100dvh;
  background:
    radial-gradient(circle at 15% 10%, rgba(124,108,255,.17), transparent 32%),
    radial-gradient(circle at 86% 12%, rgba(34,211,238,.10), transparent 30%),
    radial-gradient(circle at 52% 92%, rgba(168,85,247,.11), transparent 34%),
    linear-gradient(145deg, #060810 0%, #090d18 52%, #070a12 100%);
}
```

Ambient glow elements must be non-interactive, remain behind content, avoid aggressive animation, reduce opacity on mobile, and never create scrollbars.

---

## 7. Glassmorphism system

Glassmorphism must be hierarchical and restrained.

### 7.1 Subtle glass

Use for lightweight rows and secondary surfaces.

```css
.glass-subtle {
  background: rgba(255,255,255,.035);
  border: 1px solid rgba(255,255,255,.055);
  backdrop-filter: blur(10px) saturate(120%);
  -webkit-backdrop-filter: blur(10px) saturate(120%);
}
```

### 7.2 Standard glass

Use for primary cards, sidebar, and header.

```css
.glass-standard {
  background: rgba(15,21,35,.62);
  border: 1px solid rgba(255,255,255,.08);
  box-shadow:
    0 18px 50px rgba(0,0,0,.30),
    inset 0 1px 0 rgba(255,255,255,.045);
  backdrop-filter: blur(20px) saturate(135%);
  -webkit-backdrop-filter: blur(20px) saturate(135%);
}
```

### 7.3 Elevated glass

Use for modal, command palette, and bottom sheet.

```css
.glass-elevated {
  background: rgba(18,25,42,.80);
  border: 1px solid rgba(255,255,255,.105);
  box-shadow:
    0 28px 80px rgba(0,0,0,.44),
    inset 0 1px 0 rgba(255,255,255,.06);
  backdrop-filter: blur(28px) saturate(150%);
  -webkit-backdrop-filter: blur(28px) saturate(150%);
}
```

### 7.4 Fallback

```css
@supports not (backdrop-filter: blur(10px)) {
  .glass-subtle,
  .glass-standard,
  .glass-elevated {
    background: rgba(14,20,34,.96);
  }
}
```

Restrictions:

- no elevated glass nested inside elevated glass;
- no heavy blur on long tables or dense lists;
- no animation of blur values;
- reduce blur on mobile;
- never sacrifice contrast.

---

## 8. Gradient usage

Primary gradient:

```css
background: linear-gradient(
  135deg,
  #7c6cff 0%,
  #9d5cff 48%,
  #22d3ee 100%
);
```

Use for:

- primary CTA;
- active navigation accent;
- selected chart series;
- restrained progress indicators.

Do not apply it to every card, heading, or background.

---

# PART II — RESPONSIVE LAYOUT

## 9. Desktop shell

```text
┌────────────────────────────────────────────────────────────┐
│ Sidebar │ TopHeader                                        │
│         ├──────────────────────────────────────────────────│
│         │ Main content                                     │
│         │ Cards / lists / charts                           │
└────────────────────────────────────────────────────────────┘
```

Recommended:

- expanded sidebar: 248–272px;
- collapsed sidebar: 76–88px;
- header: 64–72px;
- main content max width: 1440px;
- page padding: 24–32px.

## 10. Mobile shell

- compact top header;
- fixed bottom navigation;
- central Add action;
- safe-area support;
- bottom padding preventing navigation overlap;
- bottom sheets instead of desktop-width modals;
- sticky primary actions for long forms where appropriate.

Mobile navigation:

- Home
- Groups
- Add
- Activity
- Profile

Breakpoints:

```text
sm 640px
md 768px
lg 1024px
xl 1280px
2xl 1536px
```

---

# PART III — COMPONENT ARCHITECTURE

## 11. Component layers

### Layer 1 — Primitives

- Button
- Input
- Select
- Checkbox
- RadioGroup
- Switch
- Badge
- Avatar
- Separator
- Tooltip
- Popover
- Dialog
- Sheet
- Tabs
- DropdownMenu

These wrap accessible Radix/shadcn-style primitives and enforce FairTab tokens.

### Layer 2 — Shared composites

- GlassPanel
- PageContainer
- SearchField
- FilterBar
- CurrencyInput
- MemberAvatar
- AvatarGroup
- SyncIndicator
- OfflineBanner
- EmptyState
- ErrorState
- Skeleton
- ConfirmDialog

### Layer 3 — Domain components

- BalanceCard
- ExpenseRow
- GroupCard
- SettlementCard
- SplitMethodSelector
- PayerEditor
- ParticipantEditor
- ActivityTimeline
- BudgetProgressCard
- ReceiptUploader

### Layer 4 — Feature screens

- OverviewPage
- GroupListPage
- GroupDetailPage
- ExpenseCreatePage
- ExpenseDetailPage
- SettlementPage
- AnalyticsPage
- SettingsPage

Low-level visual components must not fetch data directly.

---

## 12. Required reusable components

Antigravity must create:

- AppShell
- Sidebar
- MobileNavigation
- TopHeader
- PageContainer
- GradientButton
- SecondaryButton
- IconButton
- GlassPanel
- StatCard
- BalanceCard
- GroupCard
- ExpenseRow
- MemberAvatar
- AvatarGroup
- Modal
- Dialog
- BottomSheet
- CommandPalette shell
- Toast integration
- Skeleton
- BalanceCardSkeleton
- ExpenseRowSkeleton
- GroupCardSkeleton
- ChartSkeleton
- EmptyState
- ErrorState
- OfflineBanner
- SyncIndicator
- RoutePending
- ThemeToggle

Component APIs must use typed semantic variants rather than multiple ambiguous booleans.

Preferred:

```tsx
<Button variant="primary" size="lg" isLoading>
```

---

# PART IV — LOADING AND FEEDBACK STATES

## 13. Loading model

Do not use one full-screen spinner for ordinary data loading.

Use:

1. app bootstrap state;
2. route-level skeleton;
3. section skeleton;
4. inline action loading;
5. synchronization state.

Skeletons must match final layout dimensions and support reduced motion.

Required skeletons:

- balance card;
- group card;
- expense row;
- chart;
- avatar;
- activity timeline;
- settings panel.

Loading buttons must retain width, prevent duplicate submission, use `aria-busy`, and include an action label such as “Saving expense”.

---

## 14. Empty states

Required:

- no groups;
- no expenses;
- no recent activity;
- no notifications;
- no recurring expenses;
- no analytics data;
- no search results;
- no pending synchronization.

Each includes a meaningful title, short explanation, and one clear action where applicable.

---

## 15. Error states

Categories:

- validation;
- authentication;
- permission;
- network;
- conflict;
- storage;
- corrupted local cache;
- unknown.

Errors must preserve user input, explain whether retry is safe, and never expose raw Firebase stack traces.

---

## 16. Sync states

The UI must distinguish:

```text
saved locally
queued
syncing
synced
failed
conflict
```

A local save must never be described as cloud-synced before acknowledgement.

Global placement:

- header sync indicator;
- offline banner.

Entity placement:

- pending icon on expense row;
- receipt upload status;
- conflict badge.

---

# PART V — ROUTING AND PROJECT STRUCTURE

## 17. Routing

Use `HashRouter` for GitHub Pages.

Routes:

```text
/overview
/groups
/groups/:groupId
/groups/:groupId/expenses/:expenseId
/expenses
/expenses/new
/settlements
/analytics
/recurring
/notifications
/settings
/*
```

Production example:

```text
https://username.github.io/fairtab/#/groups/abc123
```

Use route-level lazy loading.

---

## 18. Feature-oriented structure

```text
src/
├── app/
│   ├── App.tsx
│   ├── bootstrap/
│   ├── providers/
│   └── router/
├── components/
│   ├── ui/
│   ├── feedback/
│   └── layout/
├── domain/
│   ├── money/
│   ├── expenses/
│   ├── balances/
│   ├── settlements/
│   └── recurring/
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── groups/
│   ├── expenses/
│   ├── settlements/
│   ├── analytics/
│   ├── receipts/
│   ├── recurring/
│   ├── notifications/
│   └── settings/
├── infrastructure/
│   ├── firebase/
│   ├── indexeddb/
│   ├── pwa/
│   └── logging/
├── services/
│   ├── sync/
│   ├── export/
│   └── currency/
├── hooks/
├── styles/
├── test/
├── types/
├── main.tsx
└── sw.ts
```

Feature folders may contain:

```text
api/
components/
hooks/
pages/
schemas/
state/
types/
utils/
index.ts
```

Expose controlled public APIs through `index.ts`.

---

# PART VI — STATE AND DATA FLOW

## 19. State categories

### Remote synchronized state

- Firestore groups;
- expenses;
- settlements;
- notifications.

Use repositories and Firestore listeners. Use TanStack Query only where it improves request lifecycle or caching.

### Durable local state

- pending operations;
- receipt blobs;
- drafts;
- local search index;
- sync metadata;
- trusted-device setting.

Use Dexie/IndexedDB.

### Ephemeral UI state

- open modal;
- wizard step;
- temporary selection;
- filter drawer;
- command palette.

Use local React state or a focused Zustand store.

### Global application state

Only:

- authenticated user;
- theme;
- connectivity;
- sync summary;
- update availability.

Do not place all Firestore data in one global store.

---

## 20. Data flow

```text
UI
  ↓
Feature hook/controller
  ↓
Application service
  ↓
Domain validation/calculation
  ↓
Repository interface
  ↓
Firestore / IndexedDB adapter
```

React components must not contain debt algorithms, monetary rounding, recurrence logic, or conflict rules.

---

## 21. Forms

Use:

- React Hook Form;
- Zod;
- typed schemas;
- field-level errors;
- form-level reconciliation errors.

Requirements:

- preserve drafts where appropriate;
- focus first invalid field;
- show unallocated amount continuously;
- retain user input after recoverable errors;
- prevent double submission.

Example:

```text
Participant shares total ₹2,850, but the expense total is ₹3,000.
₹150 remains unallocated.
```

---

# PART VII — OFFLINE-FIRST UI

## 22. Offline behaviour

The app must show cached content immediately and clearly distinguish local state from cloud state.

Allowed optimistic behaviour:

- show newly created local expense immediately;
- update locally derived balances;
- show pending badge.

Not allowed:

- claim sync before acknowledgement;
- hide permission failure;
- silently drop failed writes;
- overwrite known conflicts.

---

## 23. Conflict UI

Conflict review must show:

- local version;
- cloud version;
- field-level differences;
- editor/time if known;
- balance impact;
- resolution choices.

Actions:

- keep cloud;
- use local as a new edit;
- merge supported fields;
- export local draft;
- cancel.

Use a dedicated large dialog or screen, never a toast.

---

# PART VIII — ACCESSIBILITY AND MOTION

## 24. Accessibility

Target WCAG 2.2 AA.

Required:

- semantic HTML;
- visible focus;
- keyboard support;
- labelled controls;
- modal focus trap;
- Escape handling;
- focus restoration;
- reduced motion;
- 44px touch targets where practical;
- chart text summaries;
- no colour-only meaning;
- live-region announcements for save, sync, and errors;
- adequate contrast on glass surfaces;
- usability at 200% zoom.

Reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 25. Motion

Allowed:

- 4–8px fade/slide entrance;
- button press scale to 0.98;
- accordion expansion;
- modal fade and scale;
- progress animation;
- restrained balance transition;
- skeleton shimmer.

Avoid:

- continuous floating cards;
- animated blur;
- parallax;
- long spring animations;
- decorative motion during financial entry.

Use Framer Motion only where CSS transitions are insufficient.

---

# PART IX — PERFORMANCE

## 26. Performance rules

- lazy-load charts;
- lazy-load OCR;
- route-level code splitting;
- paginate history;
- virtualize only when needed;
- compress images before upload;
- reduce glass blur on mobile;
- memoize expensive derived values;
- avoid unnecessary Firestore listeners;
- use stable list keys;
- keep analytics outside render paths.

Targets:

- LCP <= 2.5s;
- INP <= 200ms;
- CLS <= 0.1;
- Lighthouse Performance >= 90.

Bundle rules:

- charts in separate chunk;
- OCR in separate on-demand chunk;
- Firebase modular imports only;
- warn on oversized chunks;
- audit dependency weight before adding packages.

---

# PART X — TESTING

## 27. Unit tests

Required:

- AppShell;
- desktop navigation;
- mobile navigation;
- theme persistence;
- GlassPanel variants;
- loading button;
- Skeleton accessibility;
- EmptyState;
- ErrorState;
- SyncIndicator states;
- modal keyboard behaviour;
- reduced-motion handling;
- 404 route;
- financial formatting.

## 28. Integration tests

Required:

- add-expense validation;
- split method switching;
- pending offline state;
- optimistic rendering;
- sync completion;
- permanent failure;
- conflict review;
- route lazy loading;
- PWA update prompt.

## 29. End-to-end tests

Use Playwright.

Core journeys:

1. Load app shell.
2. Navigate desktop and mobile.
3. Create group.
4. Add equal expense.
5. Add percentage expense.
6. Go offline.
7. Add expense.
8. Refresh offline.
9. Reconnect.
10. Confirm one synchronized record.
11. Resolve conflict.
12. Verify GitHub Pages base path.
13. Verify PWA installability.

---

# PART XI — GITHUB PAGES AND PWA

## 30. GitHub Pages

Use:

```tsx
<HashRouter>
  <App />
</HashRouter>
```

Vite:

```ts
base: "/fairtab/"
```

Do not assume root hosting unless a custom domain is configured.

## 31. Service worker

Use `vite-plugin-pwa` with a custom service worker.

Precache:

- application shell;
- hashed JavaScript/CSS;
- icons;
- offline page;
- safe static assets.

Do not manually cache authenticated Firestore records through service-worker fetch handlers.

Update flow:

1. detect waiting worker;
2. show update prompt;
3. preserve drafts;
4. activate after confirmation;
5. reload safely.

---

# PART XII — CODE QUALITY

## 32. TypeScript

Use strict mode.

Rules:

- no implicit `any`;
- validate runtime data with Zod;
- avoid unsafe assertions;
- use discriminated unions;
- exhaustive status switches;
- no Firebase types leaking into domain models where avoidable.

Example:

```ts
type SyncStatus =
  | { type: "offline"; pendingCount: number }
  | { type: "syncing"; pendingCount: number }
  | { type: "synced"; lastSyncedAt: Date }
  | { type: "failed"; pendingCount: number; message: string }
  | { type: "conflict"; conflictCount: number };
```

## 33. Naming

- Components: PascalCase
- Hooks: `useX`
- Services: `XService`
- Repositories: `XRepository`
- Schemas: `xSchema`
- Types: PascalCase
- CSS variables: kebab-case

Avoid vague names such as `data`, `item`, `handler`, or `utils` where a precise name is possible.

## 34. Import aliases

```text
@/app
@/components
@/domain
@/features
@/infrastructure
@/services
@/styles
@/types
```

Avoid brittle deep relative imports.

## 35. Error normalization

```ts
interface AppError {
  code: string;
  category:
    | "validation"
    | "auth"
    | "permission"
    | "network"
    | "conflict"
    | "storage"
    | "unknown";
  userMessage: string;
  retryable: boolean;
  cause?: unknown;
}
```

---

# PART XIII — REQUIRED INITIAL SCREENS

## 36. Overview

- net balance card;
- owed/owing summary;
- active groups;
- recent expenses;
- trend placeholder;
- settlement suggestions;
- sync state;
- full skeleton layout.

## 37. Groups

- group cards;
- create action;
- member avatars;
- group balance;
- last activity;
- empty state;
- skeleton state.

## 38. Expenses

- search;
- filters;
- expense list;
- amount and payer context;
- category;
- sync status;
- add action;
- loading/empty/error states.

## 39. Settlements

- settlement suggestions;
- record payment action;
- explanation;
- settled state;
- currency grouping.

## 40. Analytics

- category summary;
- member contribution;
- monthly trend;
- budget status;
- accessible chart summaries;
- chart skeletons.

## 41. Settings

- profile;
- appearance;
- offline storage;
- synchronization;
- notifications;
- data export;
- cache management;
- account deletion.

---

# PART XIV — ACCEPTANCE CRITERIA

## 42. Styling

- no white flash before dark theme;
- glass surfaces remain readable;
- fallback works without backdrop-filter;
- mobile blur reduced;
- gradients restrained;
- financial values use tabular numerals;
- no horizontal overflow.

## 43. Architecture

- business logic outside UI;
- feature modules isolated;
- repositories abstract Firebase;
- IndexedDB isolated in infrastructure;
- no unnecessary global state;
- routes lazy-loaded;
- HashRouter used;
- PWA scope supports `/fairtab/`;
- forms use typed validation;
- errors normalized.

## 44. Feedback states

Every data screen provides:

- loading;
- loaded;
- empty;
- error;
- offline;
- pending/partial state;
- permission-denied state where applicable.

## 45. Accessibility

- keyboard navigation passes;
- visible focus;
- dialog focus trap;
- reduced motion;
- screen-reader labels;
- status announcements;
- chart summaries;
- contrast target met.

## 46. Performance

- code splitting present;
- charts/OCR lazy-loaded;
- no excessive listeners;
- no unbounded list rendering;
- production Lighthouse target met;
- no console errors.

---

# PART XV — ANTIGRAVITY RULES

## 47. Mandatory behaviour

Antigravity must:

1. Read this document before frontend generation.
2. Treat it as authoritative for frontend style and architecture.
3. Reuse tokens instead of hardcoded colours.
4. Build reusable components before page-specific copies.
5. Keep Firebase code out of visual components.
6. Implement loading, empty, error, offline, and sync states.
7. Validate after each meaningful batch.
8. Run lint, typecheck, tests, and build.
9. Fix failures before claiming completion.
10. Preserve `/fairtab/` GitHub Pages compatibility.
11. Avoid copying Splitwise visuals or proprietary assets.
12. Report any contradiction with PRD, TRD, SDD, or DATABASE_SCHEMA.

## 48. Required Antigravity output

After implementation, provide:

- final file tree;
- component inventory;
- route inventory;
- design token summary;
- state-management summary;
- test report;
- build report;
- known limitations;
- deferred features;
- desktop and mobile screenshots;
- accessibility notes;
- PWA and GitHub Pages verification.

---

## 49. Definition of done

Frontend work is complete only when:

- the visual system is consistent;
- desktop and mobile shells work;
- routes work under `/fairtab/`;
- all required feedback states exist;
- accessibility baseline passes;
- production build passes;
- tests pass;
- no console errors remain;
- no broken imports or placeholder routes remain;
- documentation matches implementation.
