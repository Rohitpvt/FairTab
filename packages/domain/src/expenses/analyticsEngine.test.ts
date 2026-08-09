import { describe, test, expect } from "vitest";
import {
  computeCategoryBreakdown,
  computeMemberContributions,
  computeMonthlyComparison,
  computeSpendingSummary,
  filterExpensesByPeriod,
  getCurrentBudgetPeriod,
  computeBudgetProgress,
} from "./analyticsEngine.js";
import type { ExpenseDocument, SettlementDocument } from "./types.js";
import type { BudgetDocument } from "./budgetTypes.js";

// Helper to make a mock active expense
function makeMockExpense(overrides: Partial<ExpenseDocument> = {}): ExpenseDocument {
  return {
    id: "exp-1",
    groupId: "group-1",
    title: "Mock Expense",
    category: "food",
    incurredAt: { seconds: 1774828800, nanoseconds: 0 }, // 2026-03-30
    currency: "USD",
    amountMinor: 1000,
    groupBaseCurrency: "USD",
    baseAmountMinor: 1000,
    fx: { mode: "same_currency", numerator: 1, denominator: 1 },
    splitMethod: "equal",
    payers: [{ memberId: "member-alice", amountMinor: 1000, baseAmountMinor: 1000 }],
    splits: [
      { memberId: "member-alice", amountMinor: 500, baseAmountMinor: 500 },
      { memberId: "member-bob", amountMinor: 500, baseAmountMinor: 500 },
    ],
    payerMemberIds: ["member-alice"],
    participantMemberIds: ["member-alice", "member-bob"],
    status: "active",
    createdAt: { seconds: 1774828800, nanoseconds: 0 },
    createdBy: "user-alice",
    updatedAt: { seconds: 1774828800, nanoseconds: 0 },
    updatedBy: "user-alice",
    version: 1,
    schemaVersion: 1,
    latestOperationId: "op-1",
    ...overrides,
  };
}

describe("Domain Analytics Engine Logic", () => {
  describe("computeCategoryBreakdown", () => {
    test("aggregates spending by category and excludes voided expenses", () => {
      const expenses = [
        makeMockExpense({ category: "food", baseAmountMinor: 1500 }),
        makeMockExpense({ category: "food", baseAmountMinor: 500 }),
        makeMockExpense({ category: "transport", baseAmountMinor: 1000 }),
        makeMockExpense({ category: "shopping", baseAmountMinor: 2000, status: "voided" }),
      ];

      const breakdown = computeCategoryBreakdown(expenses);

      expect(breakdown).toHaveLength(2);
      
      // Sorted descending by totalMinor
      expect(breakdown[0].category).toBe("food");
      expect(breakdown[0].totalMinor).toBe(2000);
      expect(breakdown[0].count).toBe(2);
      expect(breakdown[0].percentageBps).toBe(6667); // 2000 / 3000 = 66.67%

      expect(breakdown[1].category).toBe("transport");
      expect(breakdown[1].totalMinor).toBe(1000);
      expect(breakdown[1].count).toBe(1);
      expect(breakdown[1].percentageBps).toBe(3333); // 1000 / 3000 = 33.33%
    });

    test("handles zero spending correctly", () => {
      const breakdown = computeCategoryBreakdown([]);
      expect(breakdown).toHaveLength(0);
    });
  });

  describe("computeMemberContributions", () => {
    test("calculates paid vs owed totals for all active members", () => {
      const expenses = [
        makeMockExpense({
          baseAmountMinor: 1000,
          payers: [{ memberId: "member-alice", amountMinor: 1000, baseAmountMinor: 1000 }],
          splits: [
            { memberId: "member-alice", amountMinor: 500, baseAmountMinor: 500 },
            { memberId: "member-bob", amountMinor: 500, baseAmountMinor: 500 },
          ],
        }),
        makeMockExpense({
          baseAmountMinor: 600,
          payers: [{ memberId: "member-bob", amountMinor: 600, baseAmountMinor: 600 }],
          splits: [
            { memberId: "member-alice", amountMinor: 200, baseAmountMinor: 200 },
            { memberId: "member-bob", amountMinor: 400, baseAmountMinor: 400 },
          ],
        }),
      ];

      const members = [
        { memberId: "member-alice", displayName: "Alice" },
        { memberId: "member-bob", displayName: "Bob" },
        { memberId: "member-charlie", displayName: "Charlie" },
      ];

      const contributions = computeMemberContributions(expenses, members);

      expect(contributions).toHaveLength(3);

      const alice = contributions.find((c) => c.memberId === "member-alice")!;
      expect(alice.paidMinor).toBe(1000);
      expect(alice.owedMinor).toBe(700);
      expect(alice.netMinor).toBe(300); // alice paid 1000 but only owed 700 (+300)

      const bob = contributions.find((c) => c.memberId === "member-bob")!;
      expect(bob.paidMinor).toBe(600);
      expect(bob.owedMinor).toBe(900);
      expect(bob.netMinor).toBe(-300); // bob paid 600 but owed 900 (-300)

      const charlie = contributions.find((c) => c.memberId === "member-charlie")!;
      expect(charlie.paidMinor).toBe(0);
      expect(charlie.owedMinor).toBe(0);
      expect(charlie.netMinor).toBe(0);
    });
  });

  describe("computeMonthlyComparison", () => {
    test("aggregates spending by YYYY-MM key and sorts chronologically", () => {
      const expenses = [
        makeMockExpense({ incurredAt: { seconds: 1768483200, nanoseconds: 0 }, baseAmountMinor: 1000 }), // 2026-01-15
        makeMockExpense({ incurredAt: { seconds: 1771161600, nanoseconds: 0 }, baseAmountMinor: 1500 }), // 2026-02-15
        makeMockExpense({ incurredAt: { seconds: 1773571200, nanoseconds: 0 }, baseAmountMinor: 2000 }), // 2026-03-15
      ];

      const comp = computeMonthlyComparison(expenses);

      expect(comp).toHaveLength(3);
      expect(comp[0].month).toBe("2026-01");
      expect(comp[0].totalMinor).toBe(1000);

      expect(comp[1].month).toBe("2026-02");
      expect(comp[1].totalMinor).toBe(1500);

      expect(comp[2].month).toBe("2026-03");
      expect(comp[2].totalMinor).toBe(2000);
    });
  });

  describe("computeSpendingSummary", () => {
    test("computes correct summary, keeping settlements and expenses separate", () => {
      const expenses = [
        makeMockExpense({ id: "exp-rec", baseAmountMinor: 2000, category: "housing" }),
        makeMockExpense({ id: "exp-normal", baseAmountMinor: 1000, category: "food" }),
      ];

      const settlements: SettlementDocument[] = [
        {
          id: "settle-1",
          groupId: "group-1",
          payerId: "member-bob",
          receiverId: "member-alice",
          amountMinor: 500,
          currency: "USD",
          baseAmountMinor: 500,
          fx: { mode: "same_currency", numerator: 1, denominator: 1 },
          status: "active",
          createdAt: { seconds: 1774828800 },
          createdBy: "user-bob",
          updatedAt: { seconds: 1774828800 },
          updatedBy: "user-bob",
          version: 1,
          schemaVersion: 1,
          latestOperationId: "op-settle",
        },
      ];

      const recurringExpenseIds = new Set(["exp-rec"]);

      const summary = computeSpendingSummary(expenses, settlements, recurringExpenseIds);

      expect(summary.totalExpensesMinor).toBe(3000);
      expect(summary.totalSettlementsMinor).toBe(500); // does not inflate expenses!
      expect(summary.averageExpenseMinor).toBe(1500);
      expect(summary.expenseCount).toBe(2);
      expect(summary.topCategory).toBe("housing");
      expect(summary.recurringMinor).toBe(2000);
      expect(summary.nonRecurringMinor).toBe(1000);
    });
  });

  describe("filterExpensesByPeriod", () => {
    test("filters expenses based on start and end dates", () => {
      const expenses = [
        makeMockExpense({ id: "1", incurredAt: { seconds: 1769817600 } }), // 2026-02-01
        makeMockExpense({ id: "2", incurredAt: { seconds: 1772409600 } }), // 2026-03-01
        makeMockExpense({ id: "3", incurredAt: { seconds: 1774828800 } }), // 2026-03-30
      ];

      const filtered = filterExpensesByPeriod(expenses, "2026-03-01", "2026-03-31");
      expect(filtered).toHaveLength(2);
      expect(filtered.map((f) => f.id)).toContain("2");
      expect(filtered.map((f) => f.id)).toContain("3");
    });
  });

  describe("getCurrentBudgetPeriod", () => {
    test("calculates monthly period start and end dates correctly", () => {
      const budget: BudgetDocument = {
        id: "b-1",
        groupId: "g-1",
        name: "Monthly Cap",
        scope: "overall",
        period: "monthly",
        timeZone: "UTC",
        startDate: "2026-01-01",
        amountMinor: 5000,
        currency: "USD",
        status: "active",
        createdAt: new Date(),
        createdBy: "alice",
        updatedAt: new Date(),
        updatedBy: "alice",
        version: 1,
        schemaVersion: 1,
        latestOperationId: "op-b1",
      };

      const refDate = new Date(Date.UTC(2026, 2, 15)); // March 15, 2026
      const { periodStart, periodEnd } = getCurrentBudgetPeriod(budget, refDate);

      expect(periodStart).toBe("2026-03-01");
      expect(periodEnd).toBe("2026-03-31");
    });

    test("calculates weekly period start and end dates correctly", () => {
      const budget: BudgetDocument = {
        id: "b-2",
        groupId: "g-1",
        name: "Weekly Grocery",
        scope: "overall",
        period: "weekly",
        timeZone: "UTC",
        startDate: "2026-01-01",
        amountMinor: 1000,
        currency: "USD",
        status: "active",
        createdAt: new Date(),
        createdBy: "alice",
        updatedAt: new Date(),
        updatedBy: "alice",
        version: 1,
        schemaVersion: 1,
        latestOperationId: "op-b2",
      };

      const refDate = new Date(Date.UTC(2026, 2, 11)); // Wed March 11, 2026
      const { periodStart, periodEnd } = getCurrentBudgetPeriod(budget, refDate);

      expect(periodStart).toBe("2026-03-09"); // Monday
      expect(periodEnd).toBe("2026-03-15"); // Sunday
    });
  });

  describe("computeBudgetProgress", () => {
    const budget: BudgetDocument = {
      id: "b-1",
      groupId: "g-1",
      name: "Grocery Budget",
      scope: "category",
      category: "food",
      period: "monthly",
      timeZone: "UTC",
      startDate: "2026-03-01",
      amountMinor: 2000,
      currency: "USD",
      status: "active",
      createdAt: new Date(),
      createdBy: "alice",
      updatedAt: new Date(),
      updatedBy: "alice",
      version: 1,
      schemaVersion: 1,
      latestOperationId: "op-b1",
    };

    test("tracks category spending and reports remaining and overage status", () => {
      const expenses = [
        makeMockExpense({ category: "food", baseAmountMinor: 1500 }),
        makeMockExpense({ category: "transport", baseAmountMinor: 1000 }), // should be ignored
      ];

      const progress = computeBudgetProgress(budget, expenses);

      expect(progress.spentMinor).toBe(1500);
      expect(progress.remainingMinor).toBe(500);
      expect(progress.percentageBps).toBe(7500); // 75%
      expect(progress.isOverBudget).toBe(false);
    });

    test("triggers isOverBudget when spend exceeds limits", () => {
      const expenses = [
        makeMockExpense({ category: "food", baseAmountMinor: 2500 }),
      ];

      const progress = computeBudgetProgress(budget, expenses);

      expect(progress.spentMinor).toBe(2500);
      expect(progress.remainingMinor).toBe(-500);
      expect(progress.isOverBudget).toBe(true);
    });
  });
});
