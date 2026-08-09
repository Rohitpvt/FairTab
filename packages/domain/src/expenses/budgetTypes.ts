/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ExpenseCategory } from "./types.js";

// ── Budget Document ──

export type BudgetScope = "overall" | "category" | "member";
export type BudgetPeriod = "weekly" | "monthly" | "custom";

export interface BudgetDocument {
  id: string;
  groupId: string;
  name: string;
  scope: BudgetScope;
  /** Required when scope === "category" */
  category?: ExpenseCategory;
  /** Required when scope === "member" — this is the group memberId */
  memberId?: string;
  period: BudgetPeriod;
  timeZone: string;
  /** YYYY-MM-DD in the budget's timezone */
  startDate: string;
  /** YYYY-MM-DD in the budget's timezone — optional end boundary for custom periods */
  endDate?: string | null;
  /** Budget limit in minor units (group base currency) */
  amountMinor: number;
  currency: string;
  status: "active" | "paused" | "deleted";
  createdAt: any;
  createdBy: string; // uid
  updatedAt: any;
  updatedBy: string; // uid
  version: number;
  schemaVersion: 1;
  latestOperationId: string;
}

export interface BudgetRevision {
  id: string; // version string
  budgetId: string;
  groupId: string;
  name: string;
  scope: BudgetScope;
  category?: ExpenseCategory;
  memberId?: string;
  period: BudgetPeriod;
  timeZone: string;
  startDate: string;
  endDate?: string | null;
  amountMinor: number;
  currency: string;
  status: "active" | "paused" | "deleted";
  version: number;
  schemaVersion: 1;
  operationId: string;
  createdAt: any;
  createdBy: string;
}

export interface BudgetOperationReceipt {
  clientOperationId: string;
  groupId: string;
  type: "create" | "update" | "delete";
  actorUid: string;
  budgetId: string;
  payloadHash: string;
  createdAt: any;
  result: {
    budgetId: string;
    version: number;
  };
}

// ── Analytics Computation Types ──

export interface CategoryBreakdown {
  category: ExpenseCategory;
  totalMinor: number;
  count: number;
  percentageBps: number; // basis points (10000 = 100%)
}

export interface MemberContribution {
  memberId: string;
  displayName: string;
  paidMinor: number;
  owedMinor: number;
  netMinor: number; // paid - owed (positive = overpaid)
}

export interface MonthlyComparison {
  month: string; // YYYY-MM
  totalMinor: number;
  count: number;
}

export interface SpendingSummary {
  totalExpensesMinor: number;
  totalSettlementsMinor: number;
  averageExpenseMinor: number;
  expenseCount: number;
  topCategory: ExpenseCategory | null;
  recurringMinor: number;
  nonRecurringMinor: number;
}

export interface BudgetProgress {
  budgetId: string;
  name: string;
  scope: BudgetScope;
  category?: ExpenseCategory;
  memberId?: string;
  limitMinor: number;
  spentMinor: number;
  remainingMinor: number;
  percentageBps: number; // basis points spent
  isOverBudget: boolean;
}

export interface ExportableExpense {
  title: string;
  category: ExpenseCategory;
  date: string;
  currency: string;
  amount: string;
  baseCurrencyAmount: string;
  splitMethod: string;
  status: string;
  payers: string;
  participants: string;
}

export interface ExportableSettlement {
  payerName: string;
  receiverName: string;
  currency: string;
  amount: string;
  baseCurrencyAmount: string;
  date: string;
  status: string;
}
