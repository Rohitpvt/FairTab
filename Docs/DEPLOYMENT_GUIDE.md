# FairTab — GitHub Pages and Firebase Deployment Guide

## 1. Deployment architecture

- GitHub Pages serves the static Vite build.
- GitHub Actions performs CI and deployment.
- Firebase Authentication, Firestore, and optional Storage remain external managed services.
- The production site is typically:
  `https://<username>.github.io/<repository>/`

---

## 2. Production prerequisites

- main branch protected;
- production Firebase project configured;
- Firebase Security Rules tested and deployed;
- GitHub Pages enabled with source set to GitHub Actions;
- production environment values configured;
- application base path known;
- all checks passing.

---

## 3. Configure Vite base path

For repository `FairTab`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/FairTab/",
  plugins: [react()],
});
```

For a custom root domain, use `/`.

Prefer environment-driven configuration:
```ts
base: process.env.VITE_APP_BASE_PATH || "/FairTab/"
```

---

## 4. Router

Use HashRouter for GitHub Pages project deployments.

```tsx
<HashRouter>
  <AppRoutes />
</HashRouter>
```

This avoids direct-navigation 404 problems.

---

## 5. GitHub repository settings

1. Open repository Settings.
2. Select Pages.
3. Under Build and deployment, select **GitHub Actions**.
4. Under Environments, protect `github-pages` if desired.
5. Add required production variables/secrets.

Firebase web configuration is public at runtime. It can be stored as repository variables or secrets to avoid duplication, but secrecy must not be assumed.

Never add:
- Firebase service-account JSON;
- Admin SDK private key;
- private OCR/provider credentials.

---

## 6. GitHub Actions workflow

Create `.github/workflows/deploy-pages.yml`:

```yaml
name: Deploy GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version-file: ".nvmrc"
          cache: npm

      - name: Install
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run typecheck

      - name: Test
        run: npm test -- --run

      - name: Build
        run: npm run build
        env:
          VITE_APP_BASE_PATH: /FairTab/
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v4
```

Pin action versions to supported current releases during implementation.

---

## 7. Firebase production configuration

### Authentication
Add authorized domains:
- `<username>.github.io`;
- custom domain;
- localhost only for development.

Configure OAuth consent and provider settings.

### Firestore
Deploy:
```bash
firebase use FairTab-prod
firebase deploy --only firestore:rules,firestore:indexes
```

### Storage
If enabled:
```bash
firebase deploy --only storage
```

Confirm bucket and current billing requirements before relying on receipts.

---

## 8. PWA path configuration

Manifest and service-worker scope must include repository base.

Verify generated files under:
```text
/FairTab/manifest.webmanifest
/FairTab/sw.js
/FairTab/icons/...
```

The service worker must not claim an unintended wider scope.

Test:
- install;
- refresh;
- offline open;
- update prompt;
- asset paths.

---

## 9. Firebase configuration safety

Firebase web config in the bundle is expected. Security requirements:
- strict Rules;
- authorized domains;
- App Check where suitable;
- no unrestricted database rules;
- no Storage public write;
- no secret backend credentials.

Before public release, inspect production bundle and repository history for accidental credentials.

---

## 10. Custom domain

Optional:
1. Buy/control domain.
2. Configure GitHub Pages custom domain.
3. Add DNS records specified by GitHub.
4. Enable HTTPS.
5. Add domain to Firebase Auth authorized domains.
6. update PWA start URL/base if required.
7. verify canonical URLs.

Use one canonical host to reduce auth and PWA confusion.

---

## 11. Release process

1. Create release branch or PR.
2. Run complete CI.
3. Run Emulator/rules tests.
4. Run Playwright production build tests.
5. Complete browser checklist.
6. Deploy Firebase rules/indexes first if backward compatible.
7. Merge application deployment.
8. Verify live smoke tests.
9. Tag release.
10. Record known issues.

For breaking schema changes, deploy backward-compatible code in stages.

---

## 12. Rollback

### Frontend
- identify last known-good commit;
- use GitHub Actions workflow_dispatch on that commit/branch or revert;
- redeploy;
- verify service-worker update path.

### Rules
- retain versioned rules in Git;
- redeploy known-good rules;
- do not rollback to insecure test rules.

### Data
- avoid destructive automatic migrations;
- keep migration scripts;
- back up before migration;
- use corrective forward migration where possible.

Service workers may keep older clients temporarily. Maintain compatibility across at least one release boundary.

---

## 13. Post-deployment smoke test

- app loads at production URL;
- all static assets 200;
- no mixed content;
- auth registration/login;
- Google sign-in;
- create group;
- add expense;
- second user receives update;
- switch offline;
- reload cached group;
- add offline expense;
- reconnect and verify one sync;
- install PWA;
- run Lighthouse;
- check console and network errors.

---

## 14. Operational monitoring

Monitor:
- GitHub Actions failures;
- Pages availability;
- Firebase Authentication errors;
- Firestore usage/quota;
- Storage usage;
- rules denials;
- application sync failures;
- dependency advisories.

Set budget alerts in Google Cloud/Firebase where applicable.

---

## 15. Deployment constraints

GitHub Pages:
- static hosting only;
- published site and bandwidth limits apply;
- custom Actions deployment recommended;
- no server secrets.

Firebase:
- quotas and pricing vary by service and plan;
- offline Firestore updates synchronize when connectivity returns;
- same-document conflict behavior may be last-write-wins without custom version handling;
- Storage may require billing setup for new projects.

Review official current documentation before production launch.

---

## 16. Deployment sign-off

- [ ] Production Firebase project selected
- [ ] Rules deployed and tested
- [ ] Indexes deployed
- [ ] Auth domains configured
- [ ] Vite base correct
- [ ] HashRouter active
- [ ] PWA scope correct
- [ ] GitHub Pages source is Actions
- [ ] CI green
- [ ] Live smoke test passes
- [ ] Offline round-trip passes
- [ ] No secrets found
- [ ] Rollback path tested
