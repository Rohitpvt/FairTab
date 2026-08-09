# FairTab — Database Schema

## 1. Storage architecture

FairTab uses:

1. **Cloud Firestore** — canonical collaborative records.
2. **Cloud Storage** — optional receipt images and attachments.
3. **IndexedDB** — local outbox, pending attachments, local indexes, drafts, and device metadata.
4. **Service Worker Cache Storage** — application shell and static/runtime assets.

Firestore document structures are denormalised where required for secure queries and performance. Derived balances may be cached but the source ledger remains authoritative.

All monetary values are stored as integers in **minor units** plus currency code. Never store financial amounts as binary floating-point values.

Example:
```json
{
  "amountMinor": 123450,
  "currency": "INR"
}
```

---

## 2. Common types

```ts
type TimestampLike = FirebaseFirestore.Timestamp;

type Role = "owner" | "admin" | "member" | "viewer";
type SyncState = "local" | "queued" | "syncing" | "synced" | "failed" | "conflict";
type GroupType = "trip" | "home" | "couple" | "event" | "project" | "other";
type SplitMethod = "equal" | "exact" | "percentage" | "shares" | "weighted" | "itemized";
type MemberKind = "account" | "placeholder";
```

Common metadata:
```ts
interface AuditMetadata {
  createdAt: TimestampLike;
  createdBy: string;
  updatedAt: TimestampLike;
  updatedBy: string;
  version: number;
  schemaVersion: number;
}
```

---

## 3. Firestore hierarchy

```text
users/{uid}
users/{uid}/devices/{deviceId}
users/{uid}/preferences/{documentId}

groups/{groupId}
groups/{groupId}/members/{memberId}
groups/{groupId}/expenses/{expenseId}
groups/{groupId}/settlements/{settlementId}
groups/{groupId}/activities/{activityId}
groups/{groupId}/budgets/{budgetId}
groups/{groupId}/recurringExpenses/{templateId}
groups/{groupId}/exchangeRates/{rateId}
groups/{groupId}/balanceSnapshots/{snapshotId}

invitations/{invitationId}
notifications/{uid}/items/{notificationId}
userGroupIndex/{uid}/groups/{groupId}
```

`memberId` is not always a Firebase UID because groups can contain placeholder members. Account-backed member documents contain `userId`.

---

## 4. User document

Path: `users/{uid}`

```ts
interface UserDocument extends AuditMetadata {
  uid: string;
  displayName: string;
  displayNameLower: string;
  email: string;
  photoURL?: string;
  defaultCurrency: string;
  locale: string;
  timeZone: string;
  onboardingCompleted: boolean;
  accountStatus: "active" | "deletion_requested" | "disabled";
  lastSeenAt?: TimestampLike;
}
```

Privacy:
- the user can read/write permitted profile fields for own document;
- email should not be broadly readable through group membership documents;
- group-visible display data should be copied into member documents only as required.

---

## 5. Device document

Path: `users/{uid}/devices/{deviceId}`

```ts
interface DeviceDocument {
  deviceId: string;
  label?: string;
  platform?: string;
  createdAt: TimestampLike;
  lastSeenAt: TimestampLike;
  offlinePersistenceEnabled: boolean;
  revokedAt?: TimestampLike;
}
```

Do not treat client-provided device metadata as a security factor by itself.

---

## 6. Group document

Path: `groups/{groupId}`

```ts
interface GroupDocument extends AuditMetadata {
  id: string;
  name: string;
  nameLower: string;
  description?: string;
  type: GroupType;
  baseCurrency: string;
  icon?: string;
  imagePath?: string;

  ownerUserId: string;
  memberUserIds: string[]; // bounded mirror for rules/query convenience
  activeMemberCount: number;

  simplifyDebts: boolean;
  settlementStrategy: "minimum_transactions" | "preserve_relationships";
  status: "active" | "archived";
  archivedAt?: TimestampLike;

  latestActivityAt: TimestampLike;
}
```

Notes:
- `memberUserIds` must have an enforced maximum group size if used in documents/rules.
- The membership subcollection remains the detailed source for roles and placeholders.
- For very large groups, migrate membership checks to a different secure design or trusted backend.

---

## 7. Member document

Path: `groups/{groupId}/members/{memberId}`

```ts
interface GroupMemberDocument extends AuditMetadata {
  id: string;
  groupId: string;
  kind: MemberKind;

  userId?: string;
  displayName: string;
  displayNameLower: string;
  avatarURL?: string;

  role: Role;
  status: "active" | "invited" | "removed" | "left";
  joinedAt?: TimestampLike;
  removedAt?: TimestampLike;

  defaultWeight?: number;
}
```

Rules:
- only owner/admin can add or remove members;
- only owner can transfer ownership;
- clients cannot elevate their own role;
- a placeholder member can later be linked through an explicit merge flow.

---

## 8. Expense document

Path: `groups/{groupId}/expenses/{expenseId}`

```ts
interface ExpenseDocument extends AuditMetadata {
  id: string;
  groupId: string;

  title: string;
  titleLower: string;
  description?: string;
  categoryId: string;
  tags: string[];

  amountMinor: number;
  currency: string;
  expenseDate: TimestampLike;

  splitMethod: SplitMethod;

  payers: Array<{
    memberId: string;
    amountMinor: number;
  }>;

  participants: Array<{
    memberId: string;
    shareMinor: number;
    percentageBasisPoints?: number;
    shares?: number;
    weight?: number;
  }>;

  receipt?: {
    storagePath?: string;
    localAttachmentId?: string;
    status: "none" | "pending" | "uploaded" | "failed";
    contentType?: string;
    originalName?: string;
  };

  recurringTemplateId?: string;
  occurrenceKey?: string;

  status: "active" | "deleted";
  deletedAt?: TimestampLike;
  deletedBy?: string;

  clientMutationId: string;
  sourceDeviceId: string;
}
```

Invariants:
- `amountMinor > 0`;
- payer allocation sum equals amount;
- participant share sum equals amount;
- referenced member IDs exist and are active or historically valid;
- bounded payer/participant arrays;
- currency is supported;
- version increments by one for edits;
- immutable identity fields cannot be changed arbitrarily.

Because complex sum validation in Security Rules is limited, the application must validate client-side and, where high assurance is required, use trusted server validation. Rules should still validate shape, bounds, membership, and allowed-field changes.

---

## 9. Itemised details

To avoid oversized expense documents, itemised details may be stored as:

Path: `groups/{groupId}/expenses/{expenseId}/items/{itemId}`

```ts
interface ExpenseItemDocument {
  id: string;
  name: string;
  quantityMilli: number;
  unitPriceMinor: number;
  totalMinor: number;
  assignedMemberIds: string[];
  allocation: Array<{
    memberId: string;
    amountMinor: number;
  }>;
  order: number;
}
```

Expense summary stores aggregate itemisation status and total.

---

## 10. Settlement document

Path: `groups/{groupId}/settlements/{settlementId}`

```ts
interface SettlementDocument extends AuditMetadata {
  id: string;
  groupId: string;

  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
  currency: string;
  settledAt: TimestampLike;

  method: "cash" | "upi" | "bank" | "card_reimbursement" | "other";
  reference?: string;
  note?: string;

  status: "active" | "reversed";
  reversedAt?: TimestampLike;
  reversedBy?: string;
  reversalReason?: string;

  clientMutationId: string;
  sourceDeviceId: string;
}
```

Do not edit a historical settlement into an unrelated transaction. Prefer reversal plus replacement for auditability.

---

## 11. Activity document

Path: `groups/{groupId}/activities/{activityId}`

```ts
interface ActivityDocument {
  id: string;
  groupId: string;
  type:
    | "group_created"
    | "group_updated"
    | "member_invited"
    | "member_joined"
    | "member_removed"
    | "role_changed"
    | "expense_created"
    | "expense_updated"
    | "expense_deleted"
    | "expense_restored"
    | "settlement_created"
    | "settlement_reversed"
    | "conflict_resolved";

  actorUserId: string;
  entityType?: "group" | "member" | "expense" | "settlement";
  entityId?: string;
  summary: string;
  createdAt: TimestampLike;

  changeSet?: Record<string, {
    before?: unknown;
    after?: unknown;
  }>;
}
```

Avoid placing sensitive full receipt content or secrets in activity logs.

---

## 12. Recurring expense document

Path: `groups/{groupId}/recurringExpenses/{templateId}`

```ts
interface RecurringExpenseDocument extends AuditMetadata {
  id: string;
  groupId: string;
  title: string;
  amountMinor: number;
  currency: string;
  categoryId: string;
  payers: ExpenseDocument["payers"];
  participants: ExpenseDocument["participants"];
  splitMethod: SplitMethod;

  recurrence: {
    frequency: "daily" | "weekly" | "monthly" | "yearly";
    interval: number;
    byWeekday?: number[];
    dayOfMonth?: number;
  };

  startDate: TimestampLike;
  endDate?: TimestampLike;
  nextOccurrenceAt: TimestampLike;
  lastGeneratedThrough?: TimestampLike;

  mode: "auto_create" | "review";
  status: "active" | "paused" | "completed";
}
```

Generated expense uses deterministic:
`occurrenceKey = sha256(templateId + occurrenceDateISO)` or equivalent stable key.

---

## 13. Budget document

Path: `groups/{groupId}/budgets/{budgetId}`

```ts
interface BudgetDocument extends AuditMetadata {
  id: string;
  groupId: string;
  name: string;
  currency: string;
  amountMinor: number;
  categoryIds: string[];
  period: "weekly" | "monthly" | "custom";
  startDate: TimestampLike;
  endDate: TimestampLike;
  warningThresholds: number[];
  status: "active" | "completed" | "archived";
}
```

Budget actuals are derived locally/query-based and may be cached.

---

## 14. Invitation document

Path: `invitations/{invitationId}`

```ts
interface InvitationDocument {
  id: string;
  groupId: string;
  groupName: string;
  invitedEmailLower?: string;
  invitedUserId?: string;
  invitedBy: string;
  proposedRole: Exclude<Role, "owner">;
  tokenHash?: string;
  status: "pending" | "accepted" | "declined" | "revoked" | "expired";
  createdAt: TimestampLike;
  expiresAt: TimestampLike;
  acceptedAt?: TimestampLike;
  acceptedBy?: string;
}
```

Never store a raw reusable secret token if a hash-based flow is used.

---

## 15. Notification document

Path: `notifications/{uid}/items/{notificationId}`

```ts
interface NotificationDocument {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  groupId?: string;
  entityId?: string;
  readAt?: TimestampLike;
  createdAt: TimestampLike;
}
```

Only the target user can read/update notification read state.

---

## 16. User group index

Path: `userGroupIndex/{uid}/groups/{groupId}`

```ts
interface UserGroupIndexDocument {
  groupId: string;
  groupName: string;
  role: Role;
  status: "active" | "archived" | "left" | "removed";
  latestActivityAt: TimestampLike;
  updatedAt: TimestampLike;
}
```

This index supports efficient “my groups” queries. Writes must be tightly controlled and consistent with membership; for strong integrity use a trusted function or carefully validated batch/rules.

---

## 17. IndexedDB schema

Recommended database: `FairTab-local`, versioned migrations.

```ts
interface LocalDatabase {
  pendingOperations: PendingOperation;
  pendingAttachments: PendingAttachment;
  drafts: DraftRecord;
  localSearchIndex: SearchIndexRecord;
  syncMetadata: SyncMetadata;
  localSettings: LocalSetting;
}
```

### Pending operation

```ts
interface PendingOperation {
  id: string;                 // clientMutationId
  uid: string;
  deviceId: string;
  groupId?: string;
  entityType: string;
  entityId: string;
  operation: "create" | "update" | "delete" | "reverse";
  payload: unknown;
  baseVersion?: number;
  createdAtEpochMs: number;
  updatedAtEpochMs: number;
  retryCount: number;
  nextRetryAtEpochMs?: number;
  status: SyncState;
  lastErrorCode?: string;
  dependencyIds: string[];
}
```

### Pending attachment

```ts
interface PendingAttachment {
  id: string;
  uid: string;
  groupId: string;
  expenseId: string;
  blob: Blob;
  contentType: string;
  originalName: string;
  size: number;
  createdAtEpochMs: number;
  status: "pending" | "uploading" | "uploaded" | "failed";
}
```

### Sync metadata

```ts
interface SyncMetadata {
  key: string;
  uid: string;
  groupId?: string;
  lastSuccessfulSyncAt?: number;
  serverWatermark?: string;
  localSchemaVersion: number;
}
```

---

## 18. Currency model

Maintain a static currency metadata table:

```ts
interface CurrencyDefinition {
  code: string;
  name: string;
  symbol: string;
  minorUnitDigits: 0 | 2 | 3;
}
```

All conversion values should use decimal-safe arithmetic library or scaled integers.

Exchange rate document:
```ts
interface ExchangeRateDocument {
  base: string;
  quote: string;
  rateScaled: string;
  scale: number;
  effectiveAt: TimestampLike;
  source: "manual" | "provider";
  createdBy: string;
}
```

---

## 19. Index requirements

Likely composite indexes:

- expenses: `status ASC, expenseDate DESC`;
- expenses: `categoryId ASC, expenseDate DESC`;
- expenses: `currency ASC, expenseDate DESC`;
- activities: `createdAt DESC`;
- recurring: `status ASC, nextOccurrenceAt ASC`;
- invitations: `invitedUserId ASC, status ASC, expiresAt ASC`;
- user group index: `status ASC, latestActivityAt DESC`.

Store required indexes in `firestore.indexes.json`.

---

## 20. Security-rule strategy

Helper concepts:
- `isSignedIn()`;
- `isGroupMember(groupId)`;
- `hasGroupRole(groupId, allowedRoles)`;
- `isOwner(groupId)`;
- `isSelf(uid)`;
- `onlyAllowedFieldsChanged([...])`;
- `validMoney(amountMinor, currency)`;
- bounded string/array sizes.

Deny by default.

Rules tests must cover:
- unauthenticated denial;
- non-member denial;
- member read;
- viewer cannot write;
- member can create valid expense;
- member cannot mutate owner;
- admin cannot transfer ownership;
- removed member loses access;
- oversized receipt denied;
- invalid data types denied;
- other user notifications denied.

---

## 21. Data retention and deletion

Recommended:
- soft-deleted expenses remain for 30 days;
- activity logs retained while group exists;
- account deletion anonymises shared historical display where legally/product-appropriate;
- private profile and device records are deleted;
- local cache is cleared on explicit request;
- storage objects are removed when no active record references them.

Exact retention should be documented in privacy policy before public launch.
