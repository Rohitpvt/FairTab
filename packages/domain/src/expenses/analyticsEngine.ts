/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ExpenseDocument, SettlementDocument, ExpenseCategory } from "./types.js";
import type {
  CategoryBreakdown,
  MemberContribution,
  MonthlyComparison,
  SpendingSummary,
  BudgetDocument,
  BudgetProgress,
} from "./budgetTypes.js";

/**
 * Returns active (non-voided) expenses only.
 */
function activeExpenses(expenses: ExpenseDocument[]): ExpenseDocument[] {
  return expenses.filter((e) => e.status === "active");
}

/**
 * Returns active (non-voided) settlements only.
 */
function activeSettlements(settlements: SettlementDocument[]): SettlementDocument[] {
  return settlements.filter((s) => s.status === "active");
}

/**
 * Extract YYYY-MM from a Firestore timestamp-like field.
 */
function getMonthKey(ts: any): string {
  let seconds: number;
  if (ts && typeof ts.seconds === "number") {
    seconds = ts.seconds;
  } else if (ts && typeof ts._seconds === "number") {
    seconds = ts._seconds;
  } else if (typeof ts === "number") {
    seconds = ts;
  } else {
    return "unknown";
  }
  const d = new Date(seconds * 1000);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Extract a JS Date from a Firestore timestamp-like field.
 */
function toDate(ts: any): Date {
  let seconds: number;
  if (ts && typeof ts.seconds === "number") {
    seconds = ts.seconds;
  } else if (ts && typeof ts._seconds === "number") {
    seconds = ts._seconds;
  } else if (typeof ts === "number") {
    seconds = ts;
  } else {
    return new Date(0);
  }
  return new Date(seconds * 1000);
}

/**
 * Compute category breakdown from active expenses.
 * All amounts use baseAmountMinor (group base currency).
 */
export function computeCategoryBreakdown(expenses: ExpenseDocument[]): CategoryBreakdown[] {
  const active = activeExpenses(expenses);
  const map = new Map<ExpenseCategory, { totalMinor: number; count: number }>();

  for (const exp of active) {
    const entry = map.get(exp.category) || { totalMinor: 0, count: 0 };
    entry.totalMinor += exp.baseAmountMinor;
    entry.count += 1;
    map.set(exp.category, entry);
  }

  const grandTotal = active.reduce((sum, e) => sum + e.baseAmountMinor, 0);

  const results: CategoryBreakdown[] = [];
  for (const [category, data] of map.entries()) {
    results.push({
      category,
      totalMinor: data.totalMinor,
      count: data.count,
      percentageBps: grandTotal > 0 ? Math.round((data.totalMinor * 10000) / grandTotal) : 0,
    });
  }

  // Sort by totalMinor descending
  results.sort((a, b) => b.totalMinor - a.totalMinor);
  return results;
}

/**
 * Compute member contributions from active expenses.
 * paidMinor = total baseAmountMinor this member paid across all expenses.
 * owedMinor = total baseAmountMinor this member owes (their split share).
 * netMinor = paid - owed (positive means overpaid, negative means underpaid).
 */
export function computeMemberContributions(
  expenses: ExpenseDocument[],
  members: { memberId: string; displayName: string }[]
): MemberContribution[] {
  const active = activeExpenses(expenses);
  const paidMap = new Map<string, number>();
  const owedMap = new Map<string, number>();

  for (const exp of active) {
    for (const payer of exp.payers) {
      paidMap.set(payer.memberId, (paidMap.get(payer.memberId) || 0) + payer.baseAmountMinor);
    }
    for (const split of exp.splits) {
      owedMap.set(split.memberId, (owedMap.get(split.memberId) || 0) + split.baseAmountMinor);
    }
  }

  return members.map((m) => {
    const paid = paidMap.get(m.memberId) || 0;
    const owed = owedMap.get(m.memberId) || 0;
    return {
      memberId: m.memberId,
      displayName: m.displayName,
      paidMinor: paid,
      owedMinor: owed,
      netMinor: paid - owed,
    };
  });
}

/**
 * Compute monthly spending comparison from active expenses.
 * Returns an array of { month: "YYYY-MM", totalMinor, count } sorted by month ascending.
 */
export function computeMonthlyComparison(
  expenses: ExpenseDocument[],
  monthCount: number = 6
): MonthlyComparison[] {
  const active = activeExpenses(expenses);
  const map = new Map<string, { totalMinor: number; count: number }>();

  for (const exp of active) {
    const key = getMonthKey(exp.incurredAt);
    if (key === "unknown") continue;
    const entry = map.get(key) || { totalMinor: 0, count: 0 };
    entry.totalMinor += exp.baseAmountMinor;
    entry.count += 1;
    map.set(key, entry);
  }

  const results: MonthlyComparison[] = [];
  for (const [month, data] of map.entries()) {
    results.push({ month, totalMinor: data.totalMinor, count: data.count });
  }

  results.sort((a, b) => a.month.localeCompare(b.month));

  // Return only the last N months
  if (results.length > monthCount) {
    return results.slice(results.length - monthCount);
  }
  return results;
}

/**
 * Compute overall spending summary.
 * Settlements adjust balances but do NOT inflate totalExpensesMinor.
 * recurringTemplateIds: set of templateIds associated with recurring expenses.
 */
export function computeSpendingSummary(
  expenses: ExpenseDocument[],
  settlements: SettlementDocument[],
  recurringExpenseIds: Set<string> = new Set()
): SpendingSummary {
  const active = activeExpenses(expenses);
  const activeSettle = activeSettlements(settlements);

  const totalExpensesMinor = active.reduce((sum, e) => sum + e.baseAmountMinor, 0);
  const totalSettlementsMinor = activeSettle.reduce((sum, s) => sum + s.baseAmountMinor, 0);
  const expenseCount = active.length;
  const averageExpenseMinor = expenseCount > 0 ? Math.round(totalExpensesMinor / expenseCount) : 0;

  // Top category
  const catMap = new Map<ExpenseCategory, number>();
  for (const exp of active) {
    catMap.set(exp.category, (catMap.get(exp.category) || 0) + exp.baseAmountMinor);
  }
  let topCategory: ExpenseCategory | null = null;
  let topAmount = 0;
  for (const [cat, amount] of catMap.entries()) {
    if (amount > topAmount) {
      topAmount = amount;
      topCategory = cat;
    }
  }

  // Recurring vs non-recurring
  let recurringMinor = 0;
  let nonRecurringMinor = 0;
  for (const exp of active) {
    if (recurringExpenseIds.has(exp.id)) {
      recurringMinor += exp.baseAmountMinor;
    } else {
      nonRecurringMinor += exp.baseAmountMinor;
    }
  }

  return {
    totalExpensesMinor,
    totalSettlementsMinor,
    averageExpenseMinor,
    expenseCount,
    topCategory,
    recurringMinor,
    nonRecurringMinor,
  };
}

/**
 * Filter expenses to those whose incurredAt falls within [startDate, endDate] in the given timezone.
 * Dates are YYYY-MM-DD strings interpreted in the given timezone.
 */
export function filterExpensesByPeriod(
  expenses: ExpenseDocument[],
  startDate: string,
  endDate: string
): ExpenseDocument[] {
  // Parse start/end as UTC midnight boundaries for simplicity
  // In production with real TZ support, use Intl.DateTimeFormat or a library
  const startMs = new Date(startDate + "T00:00:00Z").getTime();
  const endMs = new Date(endDate + "T23:59:59.999Z").getTime();

  return expenses.filter((exp) => {
    const d = toDate(exp.incurredAt);
    const ms = d.getTime();
    return ms >= startMs && ms <= endMs;
  });
}

/**
 * Get the current period boundaries for a budget.
 * Returns { periodStart: YYYY-MM-DD, periodEnd: YYYY-MM-DD } for the current active period.
 */
export function getCurrentBudgetPeriod(
  budget: BudgetDocument,
  referenceDate: Date = new Date()
): { periodStart: string; periodEnd: string } {
  if (budget.period === "custom") {
    return {
      periodStart: budget.startDate,
      periodEnd: budget.endDate || budget.startDate,
    };
  }

  const refYear = referenceDate.getUTCFullYear();
  const refMonth = referenceDate.getUTCMonth(); // 0-indexed

  if (budget.period === "monthly") {
    const start = new Date(Date.UTC(refYear, refMonth, 1));
    const end = new Date(Date.UTC(refYear, refMonth + 1, 0)); // last day of month
    return {
      periodStart: start.toISOString().slice(0, 10),
      periodEnd: end.toISOString().slice(0, 10),
    };
  }

  // weekly: find the Monday-Sunday week containing referenceDate
  const dayOfWeek = referenceDate.getUTCDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(Date.UTC(refYear, refMonth, referenceDate.getUTCDate() + mondayOffset));
  const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);

  return {
    periodStart: monday.toISOString().slice(0, 10),
    periodEnd: sunday.toISOString().slice(0, 10),
  };
}

/**
 * Compute budget progress for a single budget against filtered expenses.
 */
export function computeBudgetProgress(
  budget: BudgetDocument,
  periodExpenses: ExpenseDocument[]
): BudgetProgress {
  const active = activeExpenses(periodExpenses);

  let spentMinor = 0;

  if (budget.scope === "overall") {
    spentMinor = active.reduce((sum, e) => sum + e.baseAmountMinor, 0);
  } else if (budget.scope === "category" && budget.category) {
    spentMinor = active
      .filter((e) => e.category === budget.category)
      .reduce((sum, e) => sum + e.baseAmountMinor, 0);
  } else if (budget.scope === "member" && budget.memberId) {
    // Member budget: sum the member's split share (what they owe)
    for (const exp of active) {
      for (const split of exp.splits) {
        if (split.memberId === budget.memberId) {
          spentMinor += split.baseAmountMinor;
        }
      }
    }
  }

  const remainingMinor = budget.amountMinor - spentMinor;
  const percentageBps = budget.amountMinor > 0
    ? Math.round((spentMinor * 10000) / budget.amountMinor)
    : spentMinor > 0 ? 10000 : 0;

  return {
    budgetId: budget.id,
    name: budget.name,
    scope: budget.scope,
    category: budget.category,
    memberId: budget.memberId,
    limitMinor: budget.amountMinor,
    spentMinor,
    remainingMinor,
    percentageBps,
    isOverBudget: spentMinor > budget.amountMinor,
  };
}
