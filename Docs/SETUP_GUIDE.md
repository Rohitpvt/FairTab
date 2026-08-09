# FairTab — Setup Guide

## 1. Prerequisites

Install:
- Git;
- a current supported Node.js LTS release;
- npm;
- Firebase CLI;
- a modern browser;
- Java runtime if required by the Firebase Emulator Suite.

Accounts:
- GitHub;
- Google/Firebase.

---

## 2. Create the repository

```bash
git clone <your-repository-url>
cd FairTab
```

For a new project:

```bash
npm create vite@latest . -- --template react-ts
npm install
```

Enable strict TypeScript and add quality tooling.

---

## 3. Install recommended packages

Example package groups; verify compatible current versions before installation.

```bash
npm install firebase react-router-dom zod react-hook-form \
  @hookform/resolvers dexie zustand @tanstack/react-query \
  recharts lucide-react framer-motion sonner

npm install -D tailwindcss postcss autoprefixer vite-plugin-pwa \
  vitest @testing-library/react @testing-library/jest-dom \
  @testing-library/user-event playwright eslint prettier \
  firebase-tools
```

If using shadcn/ui, initialize it according to its current official CLI.

---

## 4. Firebase project creation

1. Open Firebase Console.
2. Create separate projects:
   - `FairTab-dev`
   - `FairTab-prod`
3. Register a Web App in each.
4. Enable Authentication providers:
   - Email/Password
   - Google
5. Create Cloud Firestore.
6. Select region deliberately; changing location later may be difficult.
7. Add authorized domains:
   - `localhost`
   - your GitHub Pages hostname
   - custom domain if used.
8. Enable Cloud Storage only when required and after confirming current billing requirements.
9. Never download or expose Admin SDK service-account credentials to the frontend.

---

## 5. Local environment

Create `.env.local`:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_APP_BASE_PATH=/
VITE_USE_FIREBASE_EMULATORS=true
```

Create `.env.example` with empty values.

Remember: Vite client variables are public in the generated bundle. Security comes from Firebase Security Rules, not hidden Firebase config.

---

## 6. Firebase initialization

```bash
firebase login
firebase init
```

Select:
- Firestore;
- Storage if used;
- Emulators.

Do not select Firebase Hosting as the primary production host if the plan is GitHub Pages, though it can be used separately for previews if desired.

Recommended files:
- `firebase.json`
- `.firebaserc`
- `firestore.rules`
- `firestore.indexes.json`
- `storage.rules`

---

## 7. Emulator configuration

Suggested ports:

```json
{
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "storage": { "port": 9199 },
    "ui": { "enabled": true, "port": 4000 }
  }
}
```

Start:
```bash
firebase emulators:start
```

Application code must connect to emulators only when explicitly enabled and running in development.

---

## 8. Firebase initialization module

Create a single initialization module:
`src/infrastructure/firebase/firebase.ts`

Responsibilities:
- validate environment values;
- initialize app once;
- export Auth, Firestore, and Storage instances;
- connect emulators in development;
- configure persistent local Firestore cache;
- handle multi-tab persistence limitations gracefully;
- never initialize Admin SDK.

---

## 9. PWA setup

Use `vite-plugin-pwa`.

Recommended strategy:
- `injectManifest` for custom service worker;
- app manifest;
- offline fallback;
- update prompt;
- precache hashed build output.

Create:
- `src/sw.ts`;
- `public/offline.html`;
- `public/icons/icon-192.png`;
- `public/icons/icon-512.png`;
- maskable icon;
- Apple touch icon.

Do not cache Firestore user data through arbitrary service-worker fetch rules.

---

## 10. Routing setup

For GitHub project Pages, use `HashRouter`.

Example URL:
```text
https://username.github.io/FairTab/#/groups/abc
```

Configure Vite base:

```ts
export default defineConfig({
  base: process.env.VITE_APP_BASE_PATH || "/FairTab/",
});
```

For local development set base to `/`.

---

## 11. Design system setup

Create:
- `src/styles/tokens.css`;
- `src/styles/globals.css`;
- reusable glass classes;
- reduced-motion media query;
- semantic financial colours;
- skeleton keyframes;
- opaque fallback.

Keep blur tiers and z-index values centralized.

---

## 12. Local database setup

Create Dexie database with:
- pending operations;
- pending attachments;
- drafts;
- search index;
- sync metadata;
- local settings.

Rules:
- include UID on all sensitive records;
- verify current UID before reading cached data;
- support schema migrations;
- clear or isolate data on account switch.

---

## 13. Security rules

Start deny-all, then add minimal capabilities.

Development sequence:
1. user self-profile;
2. group member reads;
3. role-based group writes;
4. expense writes;
5. settlements;
6. invitations;
7. notifications;
8. storage.

For each rule, add Emulator tests before broadening access.

Deploy:
```bash
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only storage
```

---

## 14. Development commands

Recommended scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "format": "prettier --write .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "emulators": "firebase emulators:start",
    "test:rules": "firebase emulators:exec --only firestore,storage \"npm run test:rules:unit\""
  }
}
```

---

## 15. First run

```bash
npm ci
npm run dev
```

Verify:
- no console errors;
- auth page loads;
- responsive shell works;
- environment is displayed only through safe diagnostic info;
- emulator banner is obvious in development.

---

## 16. Recommended initial implementation order

1. CI and deployment.
2. Design system.
3. Firebase initialization and Emulator.
4. Authentication.
5. PWA shell.
6. IndexedDB.
7. Groups.
8. Money/split engine.
9. Expenses.
10. Balances and settlements.
11. Sync hardening.

---

## 17. Troubleshooting

### Blank page on GitHub Pages
Check:
- Vite `base`;
- deployed artifact contains `index.html` at its root;
- asset URLs include repository path;
- HashRouter is used.

### Firebase `auth/unauthorized-domain`
Add GitHub Pages/custom domain to Firebase Authentication authorized domains.

### Rules permission denied
Use Emulator rules tests and confirm:
- user authenticated;
- membership document exists;
- role allowed;
- payload contains only permitted fields.

### PWA does not update
- inspect service worker in DevTools;
- verify new build hash;
- confirm waiting-worker prompt;
- unregister during debugging only.

### Offline write disappears
- ensure operation is written to IndexedDB before success UI;
- verify cache is scoped to same UID;
- confirm local migration did not delete queue;
- inspect sync diagnostic screen.

### Storage upload fails
- confirm project plan/bucket exists;
- verify MIME and size;
- verify membership and Storage Rules;
- confirm correct storage path.

---

## 18. Setup completion checklist

- [ ] Repository created
- [ ] Node/npm pinned
- [ ] CI passing
- [ ] Dev/prod Firebase projects created
- [ ] Auth providers enabled
- [ ] Firestore created
- [ ] Emulators working
- [ ] Rules tracked and tested
- [ ] `.env.example` committed
- [ ] Secrets absent
- [ ] PWA shell installable
- [ ] GitHub Pages blank app deployed
- [ ] Browser console clean
