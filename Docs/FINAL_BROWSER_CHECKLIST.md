# FairTab — Final Browser and Release Checklist

Use this checklist against the production build, not only the development server.

Test accounts:
- owner;
- admin;
- member;
- viewer;
- non-member.

Test datasets:
- empty account;
- small group;
- 20-member group;
- 1,000+ expense performance fixture;
- multiple currencies;
- offline pending records;
- conflict fixture.

---

## 1. Browsers and devices

### Desktop
- [ ] Chrome current
- [ ] Chrome previous stable
- [ ] Edge current
- [ ] Firefox current
- [ ] Safari current on macOS

### Mobile
- [ ] Android Chrome
- [ ] iPhone Safari
- [ ] iPad Safari
- [ ] narrow 320px viewport
- [ ] common 360/390px viewport
- [ ] landscape orientation

---

## 2. Initial loading

- [ ] No blank white flash before dark theme.
- [ ] App shell appears before remote data.
- [ ] Route skeleton matches final layout.
- [ ] No major content shift.
- [ ] Slow network shows meaningful state.
- [ ] Offline first visit shows correct requirement for initial connection.
- [ ] Repeat offline visit loads cached shell.
- [ ] No endless spinner.

---

## 3. Visual design

- [ ] Dark gradient renders consistently.
- [ ] Glass surfaces remain readable.
- [ ] Opaque fallback works without `backdrop-filter`.
- [ ] Ambient orbs do not obscure content.
- [ ] Financial positive/negative states are clear.
- [ ] Typography and tabular numerals align.
- [ ] Hover states do not cause layout shift.
- [ ] Mobile blur/performance acceptable.
- [ ] No horizontal scrolling.
- [ ] Safe areas respected on iPhone.

---

## 4. Accessibility

- [ ] Keyboard can reach all interactive elements.
- [ ] Focus indicator visible.
- [ ] Modal focus is trapped.
- [ ] Focus returns after modal closes.
- [ ] Escape works where expected.
- [ ] Form labels are programmatically associated.
- [ ] Validation errors announced.
- [ ] Toast/sync status announced appropriately.
- [ ] Colour is not the only indicator.
- [ ] Contrast passes on glass surfaces.
- [ ] Reduced motion works.
- [ ] 200% zoom remains usable.
- [ ] Screen-reader headings/landmarks logical.
- [ ] Charts have text equivalents.
- [ ] Touch targets are adequate.

---

## 5. Authentication

- [ ] Register.
- [ ] Duplicate email error friendly.
- [ ] Password requirements clear.
- [ ] Email/password login.
- [ ] Wrong password error safe.
- [ ] Google sign-in.
- [ ] Password reset.
- [ ] Email verification flow.
- [ ] Protected routes redirect.
- [ ] Refresh preserves intended session.
- [ ] Auth domain accepted in production.
- [ ] Sign-out handles pending changes.
- [ ] Account switch cannot see previous UID cache.

---

## 6. Groups and permissions

- [ ] Create group online.
- [ ] Create group offline and sync.
- [ ] Add placeholder member.
- [ ] Invite account user.
- [ ] Accept invitation.
- [ ] Admin permissions correct.
- [ ] Member permissions correct.
- [ ] Viewer cannot write.
- [ ] Non-member cannot read.
- [ ] User cannot promote self.
- [ ] Admin cannot steal ownership.
- [ ] Removed member loses access.
- [ ] Leave/archive flows work.
- [ ] Group list updates across users.

---

## 7. Expenses

For each split type:
- [ ] Equal
- [ ] Exact
- [ ] Percentage
- [ ] Shares
- [ ] Weighted
- [ ] Itemised

Also:
- [ ] One payer.
- [ ] Multiple payers.
- [ ] Excluded participant.
- [ ] Rounding edge case.
- [ ] Zero-decimal currency.
- [ ] Three-decimal currency fixture.
- [ ] Validation catches under-allocation.
- [ ] Validation catches over-allocation.
- [ ] Edit.
- [ ] Duplicate.
- [ ] Delete.
- [ ] Undo.
- [ ] Permission denial handled.
- [ ] Long title/notes bounded.
- [ ] No duplicate save on double-click.

---

## 8. Balances and settlements

- [ ] Dashboard reconciles with fixture.
- [ ] Per-member trace is accurate.
- [ ] Net sums to zero per currency.
- [ ] Settlement full.
- [ ] Settlement partial.
- [ ] Reversal.
- [ ] Self-settlement rejected.
- [ ] Excess payment warning.
- [ ] Simplified plan preserves balances.
- [ ] Plan explanation understandable.
- [ ] Multi-currency balances stay separate by default.

---

## 9. Offline and synchronization

- [ ] Open cached group offline.
- [ ] Add expense offline.
- [ ] Edit expense offline.
- [ ] Delete expense offline.
- [ ] Record settlement offline.
- [ ] Refresh while offline.
- [ ] Pending changes survive.
- [ ] Sync indicator shows count.
- [ ] Reconnect triggers sync.
- [ ] Exactly one record created.
- [ ] Failed permission write stops retrying.
- [ ] Manual retry works.
- [ ] Two-device conflict is detected.
- [ ] Conflict comparison correct.
- [ ] Conflict resolution audited.
- [ ] Foreground trigger works.
- [ ] Service-worker update preserves draft.
- [ ] Sign-out warning appears with queue.

---

## 10. PWA

- [ ] Manifest valid.
- [ ] 192px icon.
- [ ] 512px icon.
- [ ] Maskable icon.
- [ ] Install prompt/installation works where supported.
- [ ] Standalone display.
- [ ] Start URL correct.
- [ ] Scope does not escape repository path.
- [ ] Offline fallback.
- [ ] Update prompt.
- [ ] New version activates.
- [ ] Old and new version compatibility considered.
- [ ] No stale critical assets after update.

---

## 11. Search and analytics

- [ ] Search cached expenses offline.
- [ ] Filters combine correctly.
- [ ] Date boundaries correct for timezone.
- [ ] Currency filter.
- [ ] Category totals reconcile.
- [ ] Member totals reconcile.
- [ ] Monthly trend correct.
- [ ] Empty analytics state.
- [ ] Large dataset remains responsive.
- [ ] Charts lazy-load.
- [ ] Charts have textual summaries.

---

## 12. Recurring and currency

- [ ] Daily/weekly/monthly/yearly recurrence.
- [ ] Month-end edge cases.
- [ ] Leap-year fixture.
- [ ] No duplicate occurrence after refresh.
- [ ] No duplicate across devices.
- [ ] Review mode.
- [ ] Auto-create mode.
- [ ] Manual exchange rate.
- [ ] Rate timestamp shown.
- [ ] Converted values labelled estimated.
- [ ] Original amount unchanged.

---

## 13. Receipts

- [ ] Camera/file picker.
- [ ] Image compression.
- [ ] Size/type rejection.
- [ ] Upload progress.
- [ ] Retry.
- [ ] Offline attachment persists.
- [ ] Upload after reconnect.
- [ ] Storage path authorized.
- [ ] Other group cannot read receipt.
- [ ] OCR lazy-load.
- [ ] OCR can be corrected.
- [ ] Item totals reconcile.
- [ ] Tax/tip/discount allocation.
- [ ] Deleted attachment cleanup.

---

## 14. Data export/import

- [ ] JSON export.
- [ ] CSV export.
- [ ] Unicode names.
- [ ] Large export.
- [ ] Import validation.
- [ ] Invalid schema rejected.
- [ ] Malicious HTML rendered as text.
- [ ] Import preview.
- [ ] Duplicate handling.
- [ ] Version incompatibility message.
- [ ] Account deletion.
- [ ] Local cache deletion.

---

## 15. Security

- [ ] Unauthenticated Firestore denied.
- [ ] Non-member group access denied.
- [ ] Viewer write denied.
- [ ] Role escalation denied.
- [ ] Unknown fields rejected where enforced.
- [ ] Oversized arrays rejected.
- [ ] Storage public write denied.
- [ ] Invalid MIME denied.
- [ ] Oversized file denied.
- [ ] No Admin/service-account secrets.
- [ ] No private third-party key in bundle.
- [ ] Dependency audit reviewed.
- [ ] Production rules are not test mode.
- [ ] Authorized domains restricted.
- [ ] Imported data sanitized.

---

## 16. Performance and quality

- [ ] Lighthouse Performance >= target.
- [ ] Accessibility >= target.
- [ ] Best Practices >= target.
- [ ] SEO/public shell >= target.
- [ ] Core Web Vitals acceptable.
- [ ] Bundle report reviewed.
- [ ] OCR/chart code lazy.
- [ ] No unbounded Firestore listeners.
- [ ] No console errors.
- [ ] No repeated failed requests.
- [ ] Images compressed.
- [ ] 1,000-expense fixture usable.

---

## 17. Deployment

- [ ] GitHub Action green.
- [ ] Artifact contains root `index.html`.
- [ ] Vite base path correct.
- [ ] Asset URLs correct.
- [ ] Hash routes refresh.
- [ ] Firebase rules deployed.
- [ ] Firestore indexes deployed.
- [ ] Auth production domain configured.
- [ ] Custom domain HTTPS, if used.
- [ ] Rollback tested.
- [ ] Release tagged.
- [ ] Known issues documented.

---

## Final sign-off

| Area | Owner | Date | Result |
|---|---|---|---|
| Product |  |  |  |
| UI/UX |  |  |  |
| Engineering |  |  |  |
| Security rules |  |  |  |
| Offline/sync |  |  |  |
| Accessibility |  |  |  |
| Deployment |  |  |  |

Release is blocked if any P0 financial, permission, offline-data-loss, or authentication issue remains open.
