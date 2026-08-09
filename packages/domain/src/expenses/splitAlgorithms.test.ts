import { describe, it, expect } from "vitest";
import {
  splitEqual,
  splitExact,
  splitPercentage,
  splitShares,
} from "./splitAlgorithms.js";
import { calculateBalances, BalanceExpense } from "./balances.js";
import { safeMultiply, divideAndRound, convertCurrency } from "./arithmetic.js";

describe("splitAlgorithms", () => {
  describe("Equal Split", () => {
    it("should split evenly with no remainder", () => {
      const res = splitEqual(300, ["alice", "bob", "charlie"]);
      expect(res).toEqual([
        { memberId: "alice", amountMinor: 100 },
        { memberId: "bob", amountMinor: 100 },
        { memberId: "charlie", amountMinor: 100 },
      ]);
    });

    it("should distribute remainder to stable sorted member IDs when no residual recipient is specified", () => {
      // 100 divided by 3 is 33 with remainder 1
      // alphabetical sort: alice, bob, charlie. Alice gets the remainder.
      const res = splitEqual(100, ["charlie", "bob", "alice"]);
      expect(res).toEqual([
        { memberId: "alice", amountMinor: 34 },
        { memberId: "bob", amountMinor: 33 },
        { memberId: "charlie", amountMinor: 33 },
      ]);
    });

    it("should allocate remainder to explicit residual recipient if provided and valid", () => {
      const res = splitEqual(100, ["alice", "bob", "charlie"], "charlie");
      expect(res).toEqual([
        { memberId: "alice", amountMinor: 33 },
        { memberId: "bob", amountMinor: 33 },
        { memberId: "charlie", amountMinor: 34 },
      ]);
    });
  });

  describe("Exact Split", () => {
    it("should verify correct exact splits", () => {
      const res = splitExact(500, { alice: 200, bob: 300 });
      expect(res).toEqual([
        { memberId: "alice", amountMinor: 200 },
        { memberId: "bob", amountMinor: 300 },
      ]);
    });

    it("should throw if the sum does not match", () => {
      expect(() => splitExact(500, { alice: 200, bob: 200 })).toThrow();
    });
  });

  describe("Percentage Split", () => {
    it("should split correctly based on basis points (10000 total)", () => {
      const res = splitPercentage(
        1000,
        { alice: 5000, bob: 3000, charlie: 2000 },
        ["alice", "bob", "charlie"]
      );
      expect(res).toEqual([
        { memberId: "alice", amountMinor: 500 },
        { memberId: "bob", amountMinor: 300 },
        { memberId: "charlie", amountMinor: 200 },
      ]);
    });

    it("should throw if total basis points is not 10000", () => {
      expect(() =>
        splitPercentage(1000, { alice: 5000, bob: 4000 }, ["alice", "bob"])
      ).toThrow();
    });

    it("should distribute residuals to largest fractional remainder first, then stable memberId tie-breaker", () => {
      // Amount 100 split 35%, 35%, 30% -> Bps: 3500, 3500, 3000
      // 100 * 3500 / 10000 = 35 (no remainder)
      // If amount is 101:
      // alice (35%): 101 * 3500 / 10000 = 35.35 -> base 35, remainder 3500
      // bob (35%): 101 * 3500 / 10000 = 35.35 -> base 35, remainder 3500
      // charlie (30%): 101 * 3000 / 10000 = 30.30 -> base 30, remainder 3000
      // Total base: 35+35+30 = 100. Residual = 1.
      // alice and bob both have remainder 3500. Charlie has 3000.
      // alice and bob are tied. Alphabetical tie-breaker: alice gets the residual unit.
      const res = splitPercentage(
        101,
        { alice: 3500, bob: 3500, charlie: 3000 },
        ["alice", "bob", "charlie"]
      );
      expect(res).toEqual([
        { memberId: "alice", amountMinor: 36 },
        { memberId: "bob", amountMinor: 35 },
        { memberId: "charlie", amountMinor: 30 },
      ]);
    });
  });

  describe("Shares Split", () => {
    it("should split proportionally based on share counts", () => {
      const res = splitShares(1000, { alice: 3, bob: 2 }, ["alice", "bob"]);
      expect(res).toEqual([
        { memberId: "alice", amountMinor: 600 },
        { memberId: "bob", amountMinor: 400 },
      ]);
    });

    it("should throw if total shares count is zero", () => {
      expect(() => splitShares(1000, { alice: 0, bob: 0 }, ["alice", "bob"])).toThrow();
    });

    it("should distribute residuals to largest fractional remainder first, then stable memberId tie-breaker", () => {
      // Amount 10 split 1:1:1 shares. Total shares = 3.
      // alice: 10 * 1 / 3 = 3.3333... -> base 3, remainder 1
      // bob: 10 * 1 / 3 = 3.3333... -> base 3, remainder 1
      // charlie: 10 * 1 / 3 = 3.3333... -> base 3, remainder 1
      // Total base = 9. Residual = 1.
      // All remainders are tied (1).
      // Alphabetical sorting of member IDs: alice gets it.
      const res = splitShares(10, { alice: 1, bob: 1, charlie: 1 }, [
        "charlie",
        "bob",
        "alice",
      ]);
      expect(res).toEqual([
        { memberId: "alice", amountMinor: 4 },
        { memberId: "bob", amountMinor: 3 },
        { memberId: "charlie", amountMinor: 3 },
      ]);
    });
  });
});

describe("arithmetic", () => {
  it("should handle safe integer operations", () => {
    expect(safeMultiply(100, 2)).toBe(200);
    expect(() => safeMultiply(Number.MAX_SAFE_INTEGER, 2)).toThrow();
    expect(divideAndRound(10, 3)).toBe(3);
    expect(divideAndRound(11, 3)).toBe(4);
    expect(convertCurrency(100, 3, 2)).toBe(150);
  });
});

describe("balances", () => {
  it("should calculate correct group balances", () => {
    const expenses: BalanceExpense[] = [
      {
        status: "active",
        payers: [{ memberId: "alice", baseAmountMinor: 100 }],
        splits: [
          { memberId: "alice", baseAmountMinor: 50 },
          { memberId: "bob", baseAmountMinor: 50 },
        ],
      },
      {
        status: "active",
        payers: [{ memberId: "bob", baseAmountMinor: 200 }],
        splits: [
          { memberId: "alice", baseAmountMinor: 100 },
          { memberId: "bob", baseAmountMinor: 100 },
        ],
      },
      {
        status: "voided", // ignored
        payers: [{ memberId: "alice", baseAmountMinor: 500 }],
        splits: [{ memberId: "bob", baseAmountMinor: 500 }],
      },
    ];

    const balances = calculateBalances(expenses, ["alice", "bob"]);
    // alice: paid 100, owed 50 (from exp1) + owed 100 (from exp2) = 150 owed. Net: 100 - 150 = -50
    // bob: paid 200, owed 50 (from exp1) + owed 100 (from exp2) = 150 owed. Net: 200 - 150 = +50
    expect(balances).toEqual([
      { memberId: "alice", netBaseMinor: -50 },
      { memberId: "bob", netBaseMinor: 50 },
    ]);
  });
});
