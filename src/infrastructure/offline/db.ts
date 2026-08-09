/* eslint-disable @typescript-eslint/no-explicit-any */
import Dexie, { type Table } from "dexie";
import type { ExpenseCategory, SplitMethod, ExpensePayer, ExpenseSplit } from "@fairtab/domain";

export interface ExpenseDraft {
  id: string; // Draft ID
  groupId: string;
  uid: string; // Isolated by User
  title: string;
  category: ExpenseCategory;
  incurredAtSeconds: number;
  currency: string;
  amountMinor: number;
  fxNumerator: number;
  fxDenominator: number;
  splitMethod: SplitMethod;
  payers: ExpensePayer[];
  splits: ExpenseSplit[];
  updatedAt: number;
}

export interface OutboxOperation {
  clientOperationId: string;
  groupId: string;
  uid: string; // Isolated by User
  type:
    | "create"
    | "update"
    | "void"
    | "create_settlement"
    | "void_settlement"
    | "create_recurring_template"
    | "update_recurring_template"
    | "approve_recurring_draft"
    | "skip_recurring_draft"
    | "create_budget"
    | "update_budget"
    | "delete_budget";
  payload: any; // Input payload for function call
  status: "pending" | "processing" | "failed";
  createdAt: number;
  attempts: number;
  lastAttemptAt?: number;
  errorMessage?: string;
  errorDetails?: any;
}

export interface OutboxAttempt {
  id?: number;
  clientOperationId: string;
  attemptedAt: number;
  status: "success" | "failure";
  errorMessage?: string;
}

export interface SettlementDraft {
  id: string; // Draft ID
  groupId: string;
  uid: string; // Isolated by User
  payerId: string;
  receiverId: string;
  amountMinor: number;
  currency: string;
  fxNumerator: number;
  fxDenominator: number;
  updatedAt: number;
}

export interface ReceiptDraft {
  id: string; // receiptId (draft id)
  groupId: string;
  uid: string; // isolated by user UID
  fileName: string;
  fileType: string;
  fileBlob: Blob; // The actual file binary blob stored in IndexedDB
  status: "draft" | "queued" | "uploading" | "failed" | "uploaded" | "attached";
  errorMessage?: string;
  createdAt: number;
  // OCR cached extracted results (so if they are offline, they can see/edit the draft metadata!)
  ocrMerchant?: string;
  ocrDate?: string;
  ocrCurrency?: string;
  ocrSubtotal?: number;
  ocrTax?: number;
  ocrTip?: number;
  ocrDiscount?: number;
  ocrTotal?: number;
  ocrItems?: { description: string; amountMinor: number; confidence: number; participantIds: string[] }[];
  ocrConfidence?: Record<string, number>;
}

export interface BudgetDraft {
  id: string;
  groupId: string;
  uid: string;
  name: string;
  scope: "overall" | "category" | "member";
  category?: string;
  memberId?: string;
  period: "weekly" | "monthly" | "custom";
  timeZone: string;
  startDate: string;
  endDate?: string;
  amountMinor: number;
  currency: string;
  updatedAt: number;
}

export interface OfflineInsight {
  id: string;
  uid: string;
  groupId: string;
  type: string;
  severity: string;
  title: string;
  explanation: string;
  supportingValues: string; // stringified JSON
  comparisonBaseline?: string | number;
  generatedAt: string;
  reasonCode: string;
  metadata?: string; // stringified JSON
}

export class FairTabDexie extends Dexie {
  expenseDrafts!: Table<ExpenseDraft, string>;
  expenseOutbox!: Table<OutboxOperation, string>;
  outboxAttempts!: Table<OutboxAttempt, number>;
  settlementDrafts!: Table<SettlementDraft, string>;
  receiptDrafts!: Table<ReceiptDraft, string>;
  budgetDrafts!: Table<BudgetDraft, string>;
  smartInsights!: Table<OfflineInsight, [string, string]>;

  constructor() {
    super("FairTabOfflineDB");
    this.version(6).stores({
      expenseDrafts: "id, groupId, uid",
      expenseOutbox: "clientOperationId, groupId, uid, status",
      outboxAttempts: "++id, clientOperationId",
      settlementDrafts: "id, groupId, uid",
      receiptDrafts: "id, groupId, uid, status",
      budgetDrafts: "id, groupId, uid",
      smartInsights: "[uid+id], uid, groupId",
    });
  }
}

export const offlineDb = new FairTabDexie();

export async function purgeUserOfflineData(uid: string): Promise<void> {
  // 1. Get clientOperationIds for outbox attempts
  const userOps = await offlineDb.expenseOutbox.where("uid").equals(uid).toArray();
  const opIds = userOps.map((op) => op.clientOperationId);

  // 2. Perform deletions
  await Promise.all([
    offlineDb.expenseDrafts.where("uid").equals(uid).delete(),
    offlineDb.expenseOutbox.where("uid").equals(uid).delete(),
    offlineDb.settlementDrafts.where("uid").equals(uid).delete(),
    offlineDb.receiptDrafts.where("uid").equals(uid).delete(),
    offlineDb.budgetDrafts.where("uid").equals(uid).delete(),
    offlineDb.smartInsights.where("uid").equals(uid).delete(),
    ...(opIds.length > 0 ? [offlineDb.outboxAttempts.where("clientOperationId").anyOf(opIds).delete()] : []),
  ]);

  // 3. Clear UID-scoped trusted device preferences in LocalStorage
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(`fairtab:${uid}:trusted-device`);
    // Check if there are any other active trusted devices
    let otherTrusted = false;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("fairtab:") && k.endsWith(":trusted-device") && localStorage.getItem(k) === "true") {
        otherTrusted = true;
        break;
      }
    }
    if (!otherTrusted) {
      localStorage.removeItem("fairtab:active-trusted-device");
    }
  }
}
