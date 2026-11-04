# Show HN Submission Draft — FairTab

> **Hacker News Guidelines Checklist**:
> - Must link directly to something users can try without a landing page / email wall: `https://fairtab-48340.web.app`
> - Plain, matter-of-fact title without superlatives ("best", "ultimate", "revolutionary").
> - Maintainer must be present in the comments to answer technical questions and feedback.

---

## 📌 Submission Title Options

**Option A (Recommended — Direct & Problem-Focused)**:
> `Show HN: FairTab – An offline-first, open-source group expense splitter`

**Option B (Technical Architecture Focus)**:
> `Show HN: FairTab – Local-first PWA for group expenses using IndexedDB and Web Locks`

---

## 🔗 Submission URL
`https://fairtab-48340.web.app`

---

## 💬 Top-Level Founder Comment (Post immediately after submitting)

```markdown
Hi HN! I built FairTab (https://fairtab-48340.web.app), a free, open-source group expense splitter and debt simplifier designed to work completely offline.

GitHub: https://github.com/Rohitpvt/FairTab

### Why I built this
Like many people, I got frustrated with existing tools locking essential group finance features behind paid subscriptions or adding artificial daily transaction limits. More importantly, when traveling abroad, hiking, or flying with friends, internet connectivity is often spotty or non-existent. Trying to add an expense or check who owes what shouldn't fail because you're offline.

### How it works technically
- **Offline-First PWA**: Built with React 19, Vite, and Workbox. The app shell is cached immediately.
- **Dexie.js / IndexedDB Outbox**: All operations (creating expenses, recording repayments, member updates) write to a local IndexedDB outbox queue before attempting cloud sync.
- **Concurrency & Multi-Tab Sync**: Uses the browser's native `navigator.locks` (Web Locks API) so that if you have multiple tabs open while offline, only one tab runs outbox sync when reconnecting, eliminating race conditions.
- **Strict Integer Minor-Unit Math**: No floating-point math anywhere in calculations. Currencies are handled in integer minor units (e.g. cents) with rational exchange rates `(amountMinor * fxNumerator) / fxDenominator` guarded by safe integer checks.
- **Hare-Niemeyer Remainder Allocation**: Percentage and share splits use the largest remainder method to ensure every single cent is deterministically accounted for with zero penny loss.
- **Explainable Debt Simplification**: Groups can choose between two models:
  1. *Preserve Direct Relationships* (Pairwise Netting) — you only pay the exact person who covered you.
  2. *Minimize Transactions* — greedy creditor-debtor matching for the fewest total payments.

### Try it out
You can open https://fairtab-48340.web.app directly on your phone or desktop. You can test it offline by opening DevTools, toggling "Offline" in the Network tab, adding an expense, and reconnecting.

The codebase is MIT-licensed: https://github.com/Rohitpvt/FairTab

I'd love feedback on the sync architecture, the split mechanics, or anything that feels rough. I'll be here all day to answer questions!
```
