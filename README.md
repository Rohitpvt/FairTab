# 🪙 FairTab

An offline-first group expense splitter for roommates, travelers, and friends that calculates fair shares and simplifies debts.

```bash
git clone https://github.com/Rohitpvt/FairTab.git && cd FairTab && npm install && npm run dev
```

<div align="center">

[![Live Demo](https://img.shields.io/badge/🚀%20Live%20Demo-fairtab--48340.web.app-00f2fe?style=for-the-badge&logo=firebase)](https://fairtab-48340.web.app)
[![CI Status](https://img.shields.io/github/actions/workflow/status/Rohitpvt/FairTab/deploy-pages.yml?branch=main&label=CI&style=for-the-badge)](https://github.com/Rohitpvt/FairTab/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable%20%26%20Offline-4CAF50?style=for-the-badge&logo=pwa)](https://fairtab-48340.web.app)

<br/>

![FairTab Demo](Docs/assets/demo.png)

<br/>

[Live Demo](https://fairtab-48340.web.app) • [Features](#-key-features) • [Tech Stack](#️-tech-stack) • [Getting Started](#-getting-started) • [Deployment](#-deployment) • [Contributing](CONTRIBUTING.md)

</div>

---

## ✨ Key Features

### 📶 Offline-First PWA (Zero-Network Resilience)
- **Local-First Writes**: Create expenses, record repayments, and manage memberships offline via IndexedDB outbox.
- **Auto-Sync & Conflict Resolution**: Automatically syncs pending operations when connectivity resumes with deterministic version control and conflict-resolution dialogs.
- **Installable PWA**: Fast service worker caching with non-intrusive prompt updates for desktop and mobile.

### 🧾 AI Receipt Scanning & OCR Split Builder
- **Camera / Image Upload**: Scan physical receipts and bills using AI vision extraction.
- **Itemized Split Editor**: Parse itemized receipts and assign line items to individual group members with automated tax and tip distribution.

### ⚖️ Debt Optimization & Settlement Simplification
- **Two Optimization Algorithms**:
  - **Preserve Direct Debts (Pairwise Netting)**: Keeps payments intuitive between the actual people who paid and benefited.
  - **Minimize Transactions**: Simplifies debt graphs mathematically to clear group balances in the absolute fewest transfers.
- **1-Click Settle Up**: Seamless repayment flows with prefilled payer, receiver, and debt calculations.

### 👤 Offline Placeholders & Member Ledgers
- **Offline Member Tracking**: Add non-app friends as offline placeholder members so groups can track cash contributions and shared tabs without forcing everyone to register.
- **Dedicated Member Ledger Inspector**: 1-tap ledger inspector to view any member's complete net balance, direct debts, and itemized transaction history.
- **Admin Delegation**: Group owners and admins can record offline cash/UPI settlements on behalf of placeholders.

### 🌍 Multi-Currency Ledger & Conversion
- **Global Currency Support**: Native minor-unit precision calculations for over 150+ international currencies.
- **Real-Time Exchange Rates**: Instant conversion to base group currency with transparent rate tracking.

### 📊 Personal Debt Dashboard
- **Cross-Group Net Balance**: Instant high-level summary of your global financial position (what you are owed vs what you owe across all groups).
- **Interactive Shared Activity Modal**: Breakdown of all mutual expenses and repayments between you and any specific friend.

### 🔐 Granular Role-Based Access Control (RBAC)
- **Role Hierarchy**: `Owner` ➜ `Admin` ➜ `Member` ➜ `Viewer`.
- **Security Rules**: Enforced cryptographically and backed by comprehensive Firestore Security Rules.

---

## 🛠️ Tech Stack

| Domain | Technology |
| :--- | :--- |
| **Frontend Framework** | React 19 (Hooks, Context, Modern Concurrency) |
| **Language & Types** | TypeScript 5+ (Strict mode, zero `any` policy) |
| **Bundler & Build Tool** | Vite 6 + Rolldown |
| **Styling & UI Design** | TailwindCSS + Vanilla Glassmorphism + Radix UI Primitives |
| **Backend & Cloud** | Firebase (Firestore, Authentication, Cloud Functions, Storage, Hosting) |
| **Local-First Database** | Dexie.js / IndexedDB Outbox Engine |
| **Service Worker & PWA** | Vite PWA Plugin + Workbox |
| **Icons & Feedback** | Lucide React + Sonner Toasts |
| **Validation** | Zod Schema Validation |

---

## 🚀 Getting Started

### Prerequisites
- Node.js `18.x` or higher
- npm `9.x` or higher
- A Firebase Project (with Firestore, Authentication, and Storage enabled)

### 1. Clone the Repository
```bash
git clone https://github.com/Rohitpvt/FairTab.git
cd FairTab
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy the sample environment file and add your Firebase credentials:
```bash
cp .env.example .env.local
```

Fill in your Firebase project configuration:
```env
VITE_APP_BASE_PATH=/
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_USE_FIREBASE_EMULATORS=false
```

### 4. Run Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🧪 Quality Assurance & Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Vite development server with HMR |
| `npm run lint` | Runs ESLint with zero-warning threshold (`--max-warnings=0`) |
| `npm run build` | Compiles TypeScript and builds production distribution bundle |
| `npm run preview` | Previews the production build locally |

---

## 🌐 Deployment

### Deploying to Firebase Hosting
1. Build the production application:
   ```bash
   npm run build
   ```
2. Deploy to Firebase:
   ```bash
   npx firebase deploy --only hosting
   ```
3. Deploy Firestore security rules and indexes:
   ```bash
   npx firebase deploy --only firestore
   ```

---

## 🔒 Security & Privacy
- **End-to-End Firestore Rules**: Strict validation ensuring users can only read or write expenses and groups they are active members of.
- **Immutable Financial Records**: Void-and-reissue ledger patterns to preserve tamper-proof audit trails.
- **Client Sanitization**: All client mutations pass Zod validation before submission to Firestore.

---

## 🤝 Contributing

Contributions of all kinds are welcome! Please check out the [Contributing Guide](CONTRIBUTING.md) for details on:
- Setting up the local development environment
- Running tests (`npm test`) and linters (`npm run lint`)
- Pull request and commit guidelines
- Beginner-friendly issues tagged with [`good first issue`](https://github.com/Rohitpvt/FairTab/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)

> **Maintainer SLA**: We acknowledge and triage all newly opened issues and pull requests within 24 hours.

---

## 📄 License
This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <sub>Built with ❤️ for frictionless group finance.</sub>
</div>
