/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, test, expect } from "vitest";
import { generateSmartInsights, getHistoricalMonthRanges, getLocalDateString } from "./insightsEngine.js";
import type { ExpenseDocument, SettlementDocument, RecurringTemplateDocument, RecurringOccurrenceDocument } from "./types.js";
import type { BudgetDocument } from "./budgetTypes.js";

const EMPTY_LEDGER = {
  groupId: "group-1",
  expenses: [],
  settlements: [],
  members: [
    { id: "mem-1", displayName: "Alice" },
    { id: "mem-2", displayName: "Bob" },
  ],
  budgets: [],
  templates: [],
  approvedOccurrences: [],
  groupBaseCurrency: "USD",
  referenceDate: new Date("2026-08-15T12:00:00Z"),
};

describe("Smart Insights Engine - Pure Logic Checks", () => {
  test("getLocalDateString returns correct date formatting based on timezone", () => {
    const d = new Date("2026-08-31T23:30:00Z");
    const locUtc = getLocalDateString(d, "UTC");
    expect(locUtc).toBe("2026-08-31");

    // America/New_York is -4 hours on Aug 31
    const locNy = getLocalDateString(d, "America/New_York");
    expect(locNy).toBe("2026-08-31");
  });

  test("getHistoricalMonthRanges clamps day of month correctly", () => {
    // August 31st (clamped target day is 31)
    const ref = new Date("2026-08-31T12:00:00Z");
    const timezone = "UTC";

    // 1 month ago: July (31 days) -> clamp day 31 to 31
    const r1 = getHistoricalMonthRanges(ref, timezone, 1, 31);
    expect(r1.start).toBe("2026-07-01");
    expect(r1.end).toBe("2026-07-31");

    // 2 months ago: June (30 days) -> clamp day 31 to 30
    const r2 = getHistoricalMonthRanges(ref, timezone, 2, 31);
    expect(r2.start).toBe("2026-06-01");
    expect(r2.end).toBe("2026-06-30");

    // 3 months ago: May (31 days) -> clamp day 31 to 31
    const r3 = getHistoricalMonthRanges(ref, timezone, 3, 31);
    expect(r3.start).toBe("2026-05-01");
    expect(r3.end).toBe("2026-05-31");
  });

  test("insufficient history generates no category/MoM anomalies", () => {
    // Current month has spending, but past months have zero history (no records)
    const inputs = {
      ...EMPTY_LEDGER,
      expenses: [
        {
          id: "exp-1",
          groupId: "group-1",
          title: "Dinner",
          category: "food",
          incurredAt: { seconds: new Date("2026-08-10T12:00:00Z").getTime() / 1000 },
          amountMinor: 5000,
          currency: "USD",
          groupBaseCurrency: "USD",
          baseAmountMinor: 5000,
          status: "active",
          payers: [{ memberId: "mem-1", amountMinor: 5000, baseAmountMinor: 5000 }],
          splits: [
            { memberId: "mem-1", amountMinor: 2500, baseAmountMinor: 2500 },
            { memberId: "mem-2", amountMinor: 2500, baseAmountMinor: 2500 },
          ],
        } as any,
      ],
    };

    const insights = generateSmartInsights(inputs);
    // category_spike or mom_anomaly shouldn't trigger because previous month sums are zero (which gives average total 0 -> ignored)
    const anomalies = insights.filter(i => i.type === "category_spike" || i.type === "mom_anomaly");
    expect(anomalies).toHaveLength(0);
  });

  test("category spending spikes and MoM anomalies trigger under correct thresholds", () => {
    // Current day is 15th of August.
    // Past months (May, June, July) have spending of 10.00 each on food in first 15 days.
    // August has 30.00 on food (a 200% increase/3x factor and difference of 20.00, exceeding 15.00 threshold)
    const makeExp = (id: string, dateStr: string, amount: number, cat = "food"): ExpenseDocument => ({
      id,
      groupId: "group-1",
      title: "Grocery",
      category: cat as any,
      incurredAt: { seconds: new Date(dateStr + "T12:00:00Z").getTime() / 1000 },
      amountMinor: amount,
      currency: "USD",
      groupBaseCurrency: "USD",
      baseAmountMinor: amount,
      status: "active",
      payers: [],
      splits: [],
    } as any);

    const inputs = {
      ...EMPTY_LEDGER,
      expenses: [
        // August (current)
        makeExp("exp-aug-1", "2026-08-10", 9000), // 90.00
        // July (M-1)
        makeExp("exp-jul-1", "2026-07-10", 1000), // 10.00
        // June (M-2)
        makeExp("exp-jun-1", "2026-06-10", 1000), // 10.00
        // May (M-3)
        makeExp("exp-may-1", "2026-05-10", 1000), // 10.00
      ],
    };

    const insights = generateSmartInsights(inputs);
    const spike = insights.find(i => i.type === "category_spike");
    expect(spike).toBeDefined();
    expect(spike!.severity).toBe("critical"); // 3.0 ratio >= 2.0
    expect(spike!.comparisonBaseline).toBe(1000);
    expect(spike!.reasonCode).toBe("SPIKE_FOOD");

    const mom = insights.find(i => i.type === "mom_anomaly");
    expect(mom).toBeDefined();
    expect(mom!.severity).toBe("critical"); // 30.00 spend vs 10.00 average, ratio = 3.0
  });

  test("budget-risk generates warning or critical alerts correctly", () => {
    // Current date Aug 15. Monthly budget Aug 1 - Aug 31 (48% time elapsed).
    // If spent is 90% (high risk)
    const budget: BudgetDocument = {
      id: "bgt-1",
      groupId: "group-1",
      name: "Food budget",
      scope: "category",
      category: "food",
      period: "monthly",
      timeZone: "UTC",
      startDate: "2026-08-01",
      amountMinor: 10000, // 100.00 limit
      currency: "USD",
      status: "active",
      version: 1,
    } as any;

    const makeExp = (id: string, dateStr: string, amount: number): ExpenseDocument => ({
      id,
      groupId: "group-1",
      title: "Grocery",
      category: "food",
      incurredAt: { seconds: new Date(dateStr + "T12:00:00Z").getTime() / 1000 },
      amountMinor: amount,
      currency: "USD",
      groupBaseCurrency: "USD",
      baseAmountMinor: amount,
      status: "active",
      payers: [],
      splits: [],
    } as any);

    // 1. High risk test (spent 90% when 48% elapsed)
    const inputs1 = {
      ...EMPTY_LEDGER,
      budgets: [budget],
      expenses: [makeExp("exp-1", "2026-08-05", 9000)],
    };
    const insights1 = generateSmartInsights(inputs1);
    const alert1 = insights1.find(i => i.type === "budget_risk");
    expect(alert1).toBeDefined();
    expect(alert1!.severity).toBe("warning");
    expect(alert1!.reasonCode).toBe("BUDGET_HIGH_RISK_bgt-1");

    // 2. Overspent test (spent 110%)
    const inputs2 = {
      ...EMPTY_LEDGER,
      budgets: [budget],
      expenses: [makeExp("exp-1", "2026-08-05", 11000)],
    };
    const insights2 = generateSmartInsights(inputs2);
    const alert2 = insights2.find(i => i.type === "budget_risk");
    expect(alert2).toBeDefined();
    expect(alert2!.severity).toBe("critical");
    expect(alert2!.reasonCode).toBe("BUDGET_OVERSPENT_bgt-1");
  });

  test("duplicate expense detection detects matches within 24 hours and similar titles", () => {
    const makeExp = (id: string, title: string, timeSeconds: number, amount: number): ExpenseDocument => ({
      id,
      groupId: "group-1",
      title,
      category: "food",
      incurredAt: { seconds: timeSeconds },
      amountMinor: amount,
      currency: "USD",
      groupBaseCurrency: "USD",
      baseAmountMinor: amount,
      status: "active",
      payers: [],
      splits: [],
    } as any);

    const t = 1786224000; // base epoch
    const inputs = {
      ...EMPTY_LEDGER,
      expenses: [
        makeExp("exp-1", "Starbucks Coffee", t, 500),
        makeExp("exp-2", "starbucks coffee", t + 3600, 500), // 1 hour later, similar name
        makeExp("exp-3", "Uber trip", t, 1200), // different title & category/amount
      ],
    };

    const insights = generateSmartInsights(inputs);
    const dup = insights.find(i => i.type === "duplicate_expense");
    expect(dup).toBeDefined();
    expect(dup!.title).toContain("Possible Duplicate Expense");
    expect(dup!.id).toBe("group-1:duplicate_expense:exp-1:exp-2");
  });

  test("recurring template occurrence deviations trigger change alerts", () => {
    const template: RecurringTemplateDocument = {
      id: "tmpl-1",
      groupId: "group-1",
      title: "Spotify Subscription",
      category: "entertainment",
      amountMinor: 1000, // 10.00 baseline
      currency: "USD",
      groupBaseCurrency: "USD",
      baseAmountMinor: 1000,
      payers: [],
      splits: [],
    } as any;

    const occurrence: RecurringOccurrenceDocument = {
      id: "occ-1",
      templateId: "tmpl-1",
      groupId: "group-1",
      occurrenceDate: "2026-08-10",
      status: "approved",
      expenseId: "exp-Spotify-Aug",
    } as any;

    const actualExpense: ExpenseDocument = {
      id: "exp-Spotify-Aug",
      groupId: "group-1",
      title: "Spotify Subscription (August Price Spike)",
      category: "entertainment",
      incurredAt: { seconds: new Date("2026-08-10T12:00:00Z").getTime() / 1000 },
      amountMinor: 1300, // 13.00 (30% deviation)
      currency: "USD",
      groupBaseCurrency: "USD",
      baseAmountMinor: 1300,
      status: "active",
      payers: [],
      splits: [],
    } as any;

    const inputs = {
      ...EMPTY_LEDGER,
      templates: [template],
      approvedOccurrences: [occurrence],
      expenses: [actualExpense],
    };

    const insights = generateSmartInsights(inputs);
    const alert = insights.find(i => i.type === "recurring_change");
    expect(alert).toBeDefined();
    expect(alert!.severity).toBe("warning"); // >= 25% deviation
    expect(alert!.reasonCode).toBe("RECURRING_CHANGE_tmpl-1_exp-Spotify-Aug");
  });

  test("contribution imbalances alert on significant outstanding balances", () => {
    const inputs = {
      ...EMPTY_LEDGER,
      expenses: [
        {
          id: "exp-1",
          groupId: "group-1",
          title: "Airfare",
          category: "travel",
          incurredAt: { seconds: new Date("2026-08-05T12:00:00Z").getTime() / 1000 },
          amountMinor: 15000, // 150.00 baseAmount
          currency: "USD",
          groupBaseCurrency: "USD",
          baseAmountMinor: 15000,
          status: "active",
          payers: [{ memberId: "mem-1", amountMinor: 15000, baseAmountMinor: 15000 }], // Alice paid all
          splits: [
            { memberId: "mem-1", amountMinor: 5000, baseAmountMinor: 5000 }, // Alice owes 50
            { memberId: "mem-2", amountMinor: 10000, baseAmountMinor: 10000 }, // Bob owes 100
          ],
        } as any,
      ],
      settlements: [
        // Suppose Bob paid a partial settlement of 30.00
        {
          id: "set-1",
          groupId: "group-1",
          fromMemberId: "mem-2",
          toMemberId: "mem-1",
          amountMinor: 3000, // 30.00
          baseAmountMinor: 3000,
          status: "active",
        } as any,
      ],
    };

    // Net balance:
    // Alice paid: 150.00 (expense) + 30.00 (received settlement, acts as negative credit) -> Wait!
    // Net balance minor: (paid_expense + paid_settlements) - (owed_splits + received_settlements)
    // Alice = (15000 + 0) - (5000 + 3000) = 15000 - 8000 = 7000 (+70.00 credit) -> Owed by group
    // Bob = (0 + 3000) - (10000 + 0) = 3000 - 10000 = -7000 (-70.00 debt) -> Owes group
    const insights = generateSmartInsights(inputs);

    const creditAlert = insights.find(i => i.reasonCode === "IMBALANCE_CREDIT_mem-1");
    expect(creditAlert).toBeDefined();
    expect(creditAlert!.severity).toBe("info"); // 70.00 is between 50.00 and 150.00

    const debtAlert = insights.find(i => i.reasonCode === "IMBALANCE_DEBT_mem-2");
    expect(debtAlert).toBeDefined();
    expect(debtAlert!.severity).toBe("info");
  });
});
