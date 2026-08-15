/* eslint-disable @typescript-eslint/no-explicit-any */
export type ExpenseCategory =
  | "food"
  | "transport"
  | "shopping"
  | "housing"
  | "utilities"
  | "entertainment"
  | "health"
  | "travel"
  | "education"
  | "other";

export type SplitMethod = "equal" | "exact" | "percentage" | "shares";

export interface ExpensePayer {
  memberId: string;
  amountMinor: number;
  baseAmountMinor: number;
}

export interface ExpenseSplit {
  memberId: string;
  amountMinor: number;
  baseAmountMinor: number;
  percentageBps?: number;
  shares?: number;
}

export interface ExpenseFX {
  mode: "same_currency" | "manual_snapshot";
  numerator: number;
  denominator: number;
}

export interface ExpenseDocument {
  id: string;
  groupId: string;
  title: string;
  notes?: string;
  category: ExpenseCategory;
  incurredAt: { seconds: number; nanoseconds: number } | any; // Supports Firebase/Client Timestamps
  currency: string;
  amountMinor: number;
  groupBaseCurrency: string;
  baseAmountMinor: number;
  fx: ExpenseFX;
  splitMethod: SplitMethod;
  payers: ExpensePayer[];
  splits: ExpenseSplit[];
  payerMemberIds: string[];
  participantMemberIds: string[];
  status: "active" | "voided";
  voidReason?: string;
  createdAt: { seconds: number; nanoseconds: number } | any;
  createdBy: string;
  updatedAt: { seconds: number; nanoseconds: number } | any;
  updatedBy: string;
  version: number;
  schemaVersion: 1;
  latestOperationId: string;
  receiptId?: string | null;
}

export interface ExpenseRevision {
  id: string; // matches version
  expenseId: string;
  groupId: string;
  title: string;
  notes?: string;
  category: ExpenseCategory;
  incurredAt: any;
  currency: string;
  amountMinor: number;
  groupBaseCurrency: string;
  baseAmountMinor: number;
  fx: ExpenseFX;
  splitMethod: SplitMethod;
  payers: ExpensePayer[];
  splits: ExpenseSplit[];
  payerMemberIds: string[];
  participantMemberIds: string[];
  status: "active" | "voided";
  voidReason?: string;
  version: number;
  schemaVersion: 1;
  operationId: string;
  createdAt: any;
  createdBy: string;
  receiptId?: string | null;
}

export interface ExpenseOperationReceipt {
  clientOperationId: string;
  groupId: string;
  type: "create" | "update" | "void";
  actorUid: string;
  expenseId: string;
  payloadHash: string;
  createdAt: any;
  result: {
    expenseId: string;
    version: number;
  };
}

export interface SettlementDocument {
  id: string;
  groupId: string;
  payerId: string; // memberId of the payer
  receiverId: string; // memberId of the receiver
  amountMinor: number; // in settlement currency
  currency: string;
  baseAmountMinor: number; // in group base currency
  fx: ExpenseFX;
  status: "active" | "voided";
  voidReason?: string;
  createdAt: any;
  createdBy: string; // uid
  updatedAt: any;
  updatedBy: string; // uid
  version: number;
  schemaVersion: number;
  latestOperationId: string;
  relatedExpenseId?: string;
  relatedMemberId?: string;
}

export interface SettlementRevision {
  id: string; // matches version string
  settlementId: string;
  groupId: string;
  payerId: string;
  receiverId: string;
  amountMinor: number;
  currency: string;
  baseAmountMinor: number;
  fx: ExpenseFX;
  status: "active" | "voided";
  voidReason?: string;
  version: number;
  schemaVersion: number;
  operationId: string;
  createdAt: any;
  createdBy: string;
  relatedExpenseId?: string;
  relatedMemberId?: string;
}

export interface SettlementOperationReceipt {
  clientOperationId: string;
  groupId: string;
  type: "create" | "void";
  actorUid: string;
  settlementId: string;
  payloadHash: string;
  createdAt: any;
  result: {
    settlementId: string;
    version: number;
  };
}

export interface ReceiptItem {
  description: string;
  amountMinor: number;
  confidence: number;
  participantIds: string[];
}

export interface ReceiptDocument {
  id: string;
  groupId: string;
  fileName: string;
  fileType: string;
  storagePath: string;
  status: "draft" | "queued" | "uploading" | "failed" | "uploaded" | "attached" | "voided";
  version: number;
  ocrResult?: {
    merchant: string;
    date: string;
    currency: string;
    subtotal: number;
    tax: number;
    tip: number;
    discount: number;
    total: number;
    confidence: Record<string, number>;
    items: ReceiptItem[];
  };
  expenseId?: string | null;
  createdAt: any;
  createdBy: string;
  updatedAt: any;
  updatedBy: string;
  schemaVersion: 1;
}

export interface ReceiptRevision {
  id: string; // matches version string
  receiptId: string;
  groupId: string;
  fileName: string;
  fileType: string;
  storagePath: string;
  status: "draft" | "queued" | "uploading" | "failed" | "uploaded" | "attached" | "voided";
  version: number;
  ocrResult?: {
    merchant: string;
    date: string;
    currency: string;
    subtotal: number;
    tax: number;
    tip: number;
    discount: number;
    total: number;
    confidence: Record<string, number>;
    items: ReceiptItem[];
  };
  expenseId?: string | null;
  operationId: string;
  createdAt: any;
  createdBy: string;
}

export interface ReceiptOperationReceipt {
  clientOperationId: string;
  groupId: string;
  type: "create" | "update" | "void";
  actorUid: string;
  receiptId: string;
  payloadHash: string;
  createdAt: any;
  result: {
    receiptId: string;
    version: number;
  };
}

export interface RecurringSchedule {
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  startLocalDate: string; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD
}

export interface RecurringTemplateDocument {
  id: string;
  groupId: string;
  title: string;
  notes?: string;
  category: ExpenseCategory;
  amountMinor: number;
  currency: string;
  groupBaseCurrency: string;
  baseAmountMinor: number;
  fx: ExpenseFX;
  splitMethod: SplitMethod;
  payers: ExpensePayer[];
  splits: ExpenseSplit[];
  payerMemberIds: string[];
  participantMemberIds: string[];
  schedule: RecurringSchedule;
  timeZone: string;
  status: "active" | "paused" | "ended";
  nextOccurrenceDate: string; // YYYY-MM-DD
  lastProcessedDate?: string | null; // YYYY-MM-DD
  createdAt: any;
  createdBy: string; // uid
  updatedAt: any;
  updatedBy: string; // uid
  version: number;
  schemaVersion: 1;
}

export interface RecurringOccurrenceDocument {
  id: string; // YYYY-MM-DD
  templateId: string;
  groupId: string;
  occurrenceDate: string; // YYYY-MM-DD
  status: "pending" | "approved" | "skipped";
  validationError?: string | null;
  recalculatedSplits?: ExpenseSplit[] | null;
  expenseId?: string | null;
  actionedAt?: any;
  actionedBy?: string | null; // uid
  createdAt: any;
  schemaVersion: 1;
}

export interface ParticipantPaymentDocument {
  memberId: string;
  status: "paid" | "unpaid";
  settlementIds: string[];
  markedBy: string;
  markedAt: any;
  version: number;
}


