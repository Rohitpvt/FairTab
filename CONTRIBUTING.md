# Contributing to FairTab

Thank you for your interest in contributing to **FairTab**! We welcome bug reports, feature proposals, documentation improvements, and code contributions from everyone.

---

## ⚡ Quick Start

### 1. Prerequisites
- **Node.js**: `18.x` or higher
- **npm**: `9.x` or higher
- **Git**

### 2. Fork & Clone
```bash
git clone https://github.com/YOUR_USERNAME/FairTab.git
cd FairTab
git remote add upstream https://github.com/Rohitpvt/FairTab.git
```

### 3. Install Dependencies & Run
```bash
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser. FairTab defaults to local emulator / offline mock mode out of the box, so you can test features immediately without personal cloud credentials.

---

## 🧪 Testing & Code Quality

Before opening a pull request, verify that all checks pass:

| Check | Command | Description |
| :--- | :--- | :--- |
| **Unit Tests** | `npm test` | Runs Vitest unit & domain calculation test suites |
| **Type Check** | `npm run typecheck` | Validates strict TypeScript compilation (`tsc -b --noEmit`) |
| **Linting** | `npm run lint` | Runs ESLint with zero-warning threshold (`--max-warnings=0`) |
| **Build Bundle** | `npm run build` | Compiles production assets and verifies PWA manifests |

If you add a new financial allocation or split calculation, make sure to add test cases verifying that amounts in minor units conserve zero-sum balance invariants.

---

## 🧭 Finding Something to Work On

Looking for an entry point? Check out issues tagged with:
- **`good first issue`**: Bite-sized, self-contained tasks ideal for newcomers.
- **`help wanted`**: Well-scoped improvements or features looking for contributors.

If you have questions about architecture, algorithms, or ideas, feel free to open a thread on [GitHub Discussions](https://github.com/Rohitpvt/FairTab/discussions)!

---

## 🌿 Pull Request Guidelines

1. **Create a branch**:
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```
2. **Follow conventional commit messages**:
   - `feat(expenses): add quick filter by category`
   - `fix(settlements): correct pairwise netting for inactive members`
   - `docs: update installation instructions`
3. **Keep changes surgical**: Avoid unnecessary reformatting or large unrelated refactors in a single PR.
4. **Submit your PR**: Push to your fork and submit a PR against `main`. Ensure all CI checks pass.

---

## ⏱️ Maintainer Commitment & Response SLA

We value your time. The maintainers pledge to:
- **Acknowledge and triage every newly filed Issue within 24 hours.**
- **Provide an initial review on every open Pull Request within 24 hours.**
- Guide first-time contributors patiently through any necessary test or formatting adjustments.

Thank you for helping make FairTab better for everyone!
