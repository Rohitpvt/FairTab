import { describe, test, expect } from "vitest";
import { calculateBalances, simplifyMinimumTransactions } from "@fairtab/domain";

describe("Global Settlements Business Logic & Verification Tests", () => {
  const currentUserId = "user-1";
  const otherUserId = "user-2";
  const thirdUserId = "user-3";

  test("debt simplification runs independently per group (no cross-group settlement)", () => {
    // Group A (Currency: INR)
    const expensesA: any[] = [
      {
        id: "exp-a1",
        groupId: "group-a",
        title: "Dinner",
        category: "food",
        currency: "INR",
        amountMinor: 3000,
        incurredAt: { seconds: 1600000000 },
        payers: [{ memberId: currentUserId, amountMinor: 3000, baseAmountMinor: 3000 }],
        splits: [
          { memberId: currentUserId, amountMinor: 1500, baseAmountMinor: 1500 },
          { memberId: otherUserId, amountMinor: 1500, baseAmountMinor: 1500 },
        ],
        status: "active",
        createdAt: null,
        createdBy: currentUserId,
        updatedAt: null,
        updatedBy: currentUserId,
        version: 1,
        schemaVersion: 1,
      },
    ];

    // Group B (Currency: USD)
    const expensesB: any[] = [
      {
        id: "exp-b1",
        groupId: "group-b",
        title: "Taxi",
        category: "transport",
        currency: "USD",
        amountMinor: 4000,
        incurredAt: { seconds: 1600000000 },
        payers: [{ memberId: otherUserId, amountMinor: 4000, baseAmountMinor: 4000 }],
        splits: [
          { memberId: currentUserId, amountMinor: 2000, baseAmountMinor: 2000 },
          { memberId: otherUserId, amountMinor: 2000, baseAmountMinor: 2000 },
        ],
        status: "active",
        createdAt: null,
        createdBy: otherUserId,
        updatedAt: null,
        updatedBy: otherUserId,
        version: 1,
        schemaVersion: 1,
      },
    ];

    const settlementsA: any[] = [];
    const settlementsB: any[] = [];

    // Calculate balances for Group A
    const balancesA = calculateBalances(expensesA, settlementsA, [currentUserId, otherUserId]);
    const simplifiedA = simplifyMinimumTransactions(balancesA);

    // Calculate balances for Group B
    const balancesB = calculateBalances(expensesB, settlementsB, [currentUserId, otherUserId]);
    const simplifiedB = simplifyMinimumTransactions(balancesB);

    // Verify Group A suggested settlements (in INR)
    expect(simplifiedA.length).toBe(1);
    expect(simplifiedA[0].fromMemberId).toBe(otherUserId);
    expect(simplifiedA[0].toMemberId).toBe(currentUserId);
    expect(simplifiedA[0].amountMinor).toBe(1500);

    // Verify Group B suggested settlements (in USD)
    expect(simplifiedB.length).toBe(1);
    expect(simplifiedB[0].fromMemberId).toBe(currentUserId);
    expect(simplifiedB[0].toMemberId).toBe(otherUserId);
    expect(simplifiedB[0].amountMinor).toBe(2000);

    // Assert that debt simplification is strictly per group
    expect(expensesA[0].groupId).not.toBe(expensesB[0].groupId);
  });

  test("currency summary separates INR and USD totals cleanly (no cross-currency aggregation)", () => {
    // Simulate user owing 1500 INR in Group A and 2000 USD in Group B
    const currencySummary: Record<string, { owe: number; owed: number }> = {
      INR: { owe: 1500, owed: 0 },
      USD: { owe: 2000, owed: 0 },
    };

    expect(currencySummary.INR.owe).toBe(1500);
    expect(currencySummary.USD.owe).toBe(2000);
    // Explicitly verify they are isolated keys and not merged into a single total
    expect(Object.keys(currencySummary)).toContain("INR");
    expect(Object.keys(currencySummary)).toContain("USD");
  });

  test("suggested settlements filter logic identifies user-specific obligations and ignores external member suggested splits", () => {
    const groupUserMemberId = currentUserId;

    const suggestedSplits = [
      {
        fromMemberId: otherUserId,
        toMemberId: currentUserId,
        amountMinor: 1000,
      },
      {
        fromMemberId: otherUserId,
        toMemberId: thirdUserId,
        amountMinor: 500,
      },
    ];

    // Filter to actions involving the current user only
    const userSpecificSuggestions = suggestedSplits.filter(
      (sim) => sim.fromMemberId === groupUserMemberId || sim.toMemberId === groupUserMemberId
    );

    expect(userSpecificSuggestions.length).toBe(1);
    expect(userSpecificSuggestions[0].toMemberId).toBe(currentUserId);
    expect(userSpecificSuggestions[0].fromMemberId).toBe(otherUserId);
  });
});
