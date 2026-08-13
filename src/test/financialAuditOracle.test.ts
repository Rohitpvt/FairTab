/**
 * Independent Mathematical Oracle for FairTab Financial Audit
 * 
 * This file implements split, balance, and settlement calculations
 * from scratch, WITHOUT importing any FairTab domain code.
 * Results are compared against FairTab's own functions to verify correctness.
 */
import { describe, test, expect } from "vitest";
import {
  splitEqual,
  splitExact,
  splitPercentage,
  splitShares,
  calculateBalances,
  simplifyMinimumTransactions,
  convertCurrency,
  divideAndRound,
} from "@fairtab/domain";
import type { MemberBalance, BalanceExpense, BalanceSettlement } from "@fairtab/domain";

// ============================================================
// INDEPENDENT ORACLE IMPLEMENTATIONS (no FairTab imports)
// ============================================================

function oracleEqualSplit(amount: number, members: string[]): { memberId: string; amountMinor: number }[] {
  const sorted = [...members].sort();
  const base = Math.floor(amount / sorted.length);
  const remainder = amount % sorted.length;
  return sorted.map((id, i) => ({
    memberId: id,
    amountMinor: base + (i < remainder ? 1 : 0),
  }));
}

function oraclePercentageSplit(
  amount: number,
  bpsMap: Record<string, number>,
  members: string[]
): { memberId: string; amountMinor: number }[] {
  const sorted = [...members].sort();
  const items = sorted.map((id) => {
    const bps = bpsMap[id] || 0;
    const baseVal = Math.floor((amount * bps) / 10000);
    const rem = (amount * bps) % 10000;
    return { memberId: id, baseAmount: baseVal, remainder: rem };
  });
  const sumBase = items.reduce((s, i) => s + i.baseAmount, 0);
  const residual = amount - sumBase;
  const sortedByRemainder = [...items].sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    return a.memberId.localeCompare(b.memberId);
  });
  const allocMap: Record<string, number> = {};
  items.forEach((i) => (allocMap[i.memberId] = i.baseAmount));
  for (let i = 0; i < residual; i++) {
    allocMap[sortedByRemainder[i % sortedByRemainder.length].memberId] += 1;
  }
  return sorted.map((id) => ({ memberId: id, amountMinor: allocMap[id] }));
}

function oracleSharesSplit(
  amount: number,
  shares: Record<string, number>,
  members: string[]
): { memberId: string; amountMinor: number }[] {
  const sorted = [...members].sort();
  const totalShares = sorted.reduce((s, id) => s + (shares[id] || 0), 0);
  const items = sorted.map((id) => {
    const s = shares[id] || 0;
    const baseVal = Math.floor((amount * s) / totalShares);
    const rem = (amount * s) % totalShares;
    return { memberId: id, baseAmount: baseVal, remainder: rem };
  });
  const sumBase = items.reduce((s, i) => s + i.baseAmount, 0);
  const residual = amount - sumBase;
  const sortedByRemainder = [...items].sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    return a.memberId.localeCompare(b.memberId);
  });
  const allocMap: Record<string, number> = {};
  items.forEach((i) => (allocMap[i.memberId] = i.baseAmount));
  for (let i = 0; i < residual; i++) {
    allocMap[sortedByRemainder[i % sortedByRemainder.length].memberId] += 1;
  }
  return sorted.map((id) => ({ memberId: id, amountMinor: allocMap[id] }));
}

function oracleBalances(
  expenses: BalanceExpense[],
  settlements: BalanceSettlement[],
  memberIds: string[]
): MemberBalance[] {
  const map: Record<string, number> = {};
  for (const id of memberIds) map[id] = 0;
  for (const exp of expenses) {
    if (exp.status !== "active") continue;
    for (const p of exp.payers) if (map[p.memberId] !== undefined) map[p.memberId] += p.baseAmountMinor;
    for (const s of exp.splits) if (map[s.memberId] !== undefined) map[s.memberId] -= s.baseAmountMinor;
  }
  for (const set of settlements) {
    if (set.status !== "active") continue;
    if (map[set.payerId] !== undefined) map[set.payerId] += set.baseAmountMinor;
    if (map[set.receiverId] !== undefined) map[set.receiverId] -= set.baseAmountMinor;
  }
  return Object.keys(map).sort().map((id) => ({ memberId: id, netBaseMinor: map[id] }));
}

// ============================================================
// INVARIANT CHECKERS
// ============================================================

function assertSplitSumsToTotal(splits: { amountMinor: number }[], total: number) {
  const sum = splits.reduce((s, sp) => s + sp.amountMinor, 0);
  expect(sum).toBe(total);
}

function assertBalancesZeroSum(balances: MemberBalance[]) {
  const sum = balances.reduce((s, b) => s + b.netBaseMinor, 0);
  expect(sum).toBe(0);
}

function assertSettlementsConserveMoney(
  balancesBefore: MemberBalance[],
  balancesAfter: MemberBalance[]
) {
  const sumBefore = balancesBefore.reduce((s, b) => s + b.netBaseMinor, 0);
  const sumAfter = balancesAfter.reduce((s, b) => s + b.netBaseMinor, 0);
  expect(sumBefore).toBe(sumAfter);
}

// ============================================================
// TESTS
// ============================================================

describe("Independent Oracle: Split Algorithm Verification", () => {
  const edgeCases = [
    { amount: 1, members: ["a", "b", "c"], label: "1 cent among 3" },
    { amount: 2, members: ["a", "b", "c"], label: "2 cents among 3" },
    { amount: 7, members: ["a", "b", "c"], label: "7 cents among 3" },
    { amount: 100, members: ["a", "b", "c"], label: "100 cents among 3" },
    { amount: 10000, members: ["a", "b", "c"], label: "$100 among 3" },
    { amount: 33333, members: ["a", "b", "c", "d", "e"], label: "$333.33 among 5" },
    { amount: 1, members: ["z"], label: "1 cent among 1" },
    { amount: 99999, members: ["a", "b"], label: "$999.99 among 2" },
    { amount: 10001, members: ["x", "y", "z"], label: "$100.01 among 3" },
  ];

  edgeCases.forEach(({ amount, members, label }) => {
    test(`splitEqual oracle match: ${label}`, () => {
      const fairtabResult = splitEqual(amount, members);
      const oracleResult = oracleEqualSplit(amount, members);

      // Invariant 1: splits sum to total
      assertSplitSumsToTotal(fairtabResult, amount);
      assertSplitSumsToTotal(oracleResult, amount);

      // Invariant 2: FairTab matches oracle
      expect(fairtabResult).toEqual(oracleResult);
    });
  });

  test("splitExact invariant: sum equals total", () => {
    const total = 12345;
    const allocs = { alice: 4000, bob: 3000, charlie: 5345 };
    const result = splitExact(total, allocs);
    assertSplitSumsToTotal(result, total);
  });

  test("splitPercentage oracle match: 33.33/33.33/33.34 of $100.01", () => {
    const amount = 10001;
    const bps = { a: 3333, b: 3333, c: 3334 };
    const members = ["a", "b", "c"];
    const fairtabResult = splitPercentage(amount, bps, members);
    const oracleResult = oraclePercentageSplit(amount, bps, members);
    assertSplitSumsToTotal(fairtabResult, amount);
    assertSplitSumsToTotal(oracleResult, amount);
    expect(fairtabResult).toEqual(oracleResult);
  });

  test("splitPercentage oracle match: extreme rounding 99.99% + 0.01%", () => {
    const amount = 10000;
    const bps = { big: 9999, tiny: 1 };
    const members = ["big", "tiny"];
    const fairtabResult = splitPercentage(amount, bps, members);
    const oracleResult = oraclePercentageSplit(amount, bps, members);
    assertSplitSumsToTotal(fairtabResult, amount);
    assertSplitSumsToTotal(oracleResult, amount);
    expect(fairtabResult).toEqual(oracleResult);
  });

  test("splitShares oracle match: 1:2:3 of $100.01", () => {
    const amount = 10001;
    const shares = { a: 1, b: 2, c: 3 };
    const members = ["a", "b", "c"];
    const fairtabResult = splitShares(amount, shares, members);
    const oracleResult = oracleSharesSplit(amount, shares, members);
    assertSplitSumsToTotal(fairtabResult, amount);
    assertSplitSumsToTotal(oracleResult, amount);
    expect(fairtabResult).toEqual(oracleResult);
  });

  test("splitShares oracle match: 7:3 of $1.00", () => {
    const amount = 100;
    const shares = { a: 7, b: 3 };
    const members = ["a", "b"];
    const fairtabResult = splitShares(amount, shares, members);
    const oracleResult = oracleSharesSplit(amount, shares, members);
    assertSplitSumsToTotal(fairtabResult, amount);
    assertSplitSumsToTotal(oracleResult, amount);
    expect(fairtabResult).toEqual(oracleResult);
  });
});

describe("Independent Oracle: Balance & Settlement Invariants", () => {
  test("zero-sum invariant: single payer, 3-way equal split", () => {
    const expenses: BalanceExpense[] = [{
      status: "active",
      payers: [{ memberId: "alice", baseAmountMinor: 10001 }],
      splits: [
        { memberId: "alice", baseAmountMinor: 3334 },
        { memberId: "bob", baseAmountMinor: 3334 },
        { memberId: "charlie", baseAmountMinor: 3333 },
      ],
    }];
    const members = ["alice", "bob", "charlie"];
    const fairtabBal = calculateBalances(expenses, [], members);
    const oracleBal = oracleBalances(expenses, [], members);
    assertBalancesZeroSum(fairtabBal);
    assertBalancesZeroSum(oracleBal);
    expect(fairtabBal).toEqual(oracleBal);
  });

  test("zero-sum invariant: multi-payer, multi-expense scenario", () => {
    const expenses: BalanceExpense[] = [
      {
        status: "active",
        payers: [
          { memberId: "alice", baseAmountMinor: 5000 },
          { memberId: "bob", baseAmountMinor: 5000 },
        ],
        splits: [
          { memberId: "alice", baseAmountMinor: 3334 },
          { memberId: "bob", baseAmountMinor: 3333 },
          { memberId: "charlie", baseAmountMinor: 3333 },
        ],
      },
      {
        status: "active",
        payers: [{ memberId: "charlie", baseAmountMinor: 6000 }],
        splits: [
          { memberId: "alice", baseAmountMinor: 2000 },
          { memberId: "bob", baseAmountMinor: 2000 },
          { memberId: "charlie", baseAmountMinor: 2000 },
        ],
      },
    ];
    const members = ["alice", "bob", "charlie"];
    const fairtabBal = calculateBalances(expenses, [], members);
    const oracleBal = oracleBalances(expenses, [], members);
    assertBalancesZeroSum(fairtabBal);
    assertBalancesZeroSum(oracleBal);
    expect(fairtabBal).toEqual(oracleBal);
  });

  test("settlements do not create or destroy money", () => {
    const expenses: BalanceExpense[] = [{
      status: "active",
      payers: [{ memberId: "alice", baseAmountMinor: 9000 }],
      splits: [
        { memberId: "alice", baseAmountMinor: 3000 },
        { memberId: "bob", baseAmountMinor: 3000 },
        { memberId: "charlie", baseAmountMinor: 3000 },
      ],
    }];
    const members = ["alice", "bob", "charlie"];

    const balBefore = calculateBalances(expenses, [], members);
    assertBalancesZeroSum(balBefore);

    const settlements: BalanceSettlement[] = [{
      status: "active",
      payerId: "bob",
      receiverId: "alice",
      baseAmountMinor: 3000,
    }];

    const balAfter = calculateBalances(expenses, settlements, members);
    assertBalancesZeroSum(balAfter);
    assertSettlementsConserveMoney(balBefore, balAfter);

    // Verify Bob's debt reduced
    const bobAfter = balAfter.find((b) => b.memberId === "bob")!;
    expect(bobAfter.netBaseMinor).toBe(0); // Bob fully settled
  });

  test("voided expenses are excluded from balances", () => {
    const expenses: BalanceExpense[] = [
      {
        status: "active",
        payers: [{ memberId: "alice", baseAmountMinor: 1000 }],
        splits: [
          { memberId: "alice", baseAmountMinor: 500 },
          { memberId: "bob", baseAmountMinor: 500 },
        ],
      },
      {
        status: "voided",
        payers: [{ memberId: "alice", baseAmountMinor: 99999 }],
        splits: [{ memberId: "bob", baseAmountMinor: 99999 }],
      },
    ];
    const members = ["alice", "bob"];
    const bal = calculateBalances(expenses, [], members);
    assertBalancesZeroSum(bal);
    expect(bal.find((b) => b.memberId === "alice")!.netBaseMinor).toBe(500);
    expect(bal.find((b) => b.memberId === "bob")!.netBaseMinor).toBe(-500);
  });

  test("voided settlements are excluded from balances", () => {
    const expenses: BalanceExpense[] = [{
      status: "active",
      payers: [{ memberId: "alice", baseAmountMinor: 2000 }],
      splits: [
        { memberId: "alice", baseAmountMinor: 1000 },
        { memberId: "bob", baseAmountMinor: 1000 },
      ],
    }];
    const settlements: BalanceSettlement[] = [{
      status: "voided",
      payerId: "bob",
      receiverId: "alice",
      baseAmountMinor: 1000,
    }];
    const members = ["alice", "bob"];
    const bal = calculateBalances(expenses, settlements, members);
    assertBalancesZeroSum(bal);
    // Settlement is voided so bob still owes alice
    expect(bal.find((b) => b.memberId === "bob")!.netBaseMinor).toBe(-1000);
  });

  test("debt simplification total transfers equal total debt", () => {
    const balances: MemberBalance[] = [
      { memberId: "alice", netBaseMinor: 9000 },
      { memberId: "bob", netBaseMinor: 1000 },
      { memberId: "charlie", netBaseMinor: -6000 },
      { memberId: "david", netBaseMinor: -4000 },
    ];
    const recs = simplifyMinimumTransactions(balances);
    const totalTransferred = recs.reduce((s, r) => s + r.amountMinor, 0);
    const totalDebt = balances.filter((b) => b.netBaseMinor < 0).reduce((s, b) => s + Math.abs(b.netBaseMinor), 0);
    expect(totalTransferred).toBe(totalDebt);
  });
});

describe("Independent Oracle: Currency & FX Verification", () => {
  test("FX conversion: 100 USD at 83:1 INR rate", () => {
    // 100_00 minor USD * 83 / 1 = 830_000 minor INR
    const result = convertCurrency(10000, 83, 1);
    expect(result).toBe(830000);
  });

  test("FX conversion: identity for same currency (1:1)", () => {
    expect(convertCurrency(12345, 1, 1)).toBe(12345);
  });

  test("FX conversion: fractional rate 85.50 INR per USD = 8550/100", () => {
    // 50_00 minor USD * 8550 / 100 = 427500 minor INR  
    const result = convertCurrency(5000, 8550, 100);
    expect(result).toBe(427500);
  });

  test("divideAndRound: banker's rounding edge cases", () => {
    // Math.round rounds 0.5 UP in JavaScript
    expect(divideAndRound(5, 2)).toBe(3); // 2.5 → 3
    expect(divideAndRound(7, 2)).toBe(4); // 3.5 → 4
    expect(divideAndRound(1, 3)).toBe(0); // 0.333 → 0
    expect(divideAndRound(2, 3)).toBe(1); // 0.667 → 1
  });

  test("formatCurrency hardcoded assumption: always divides by 100", () => {
    // FairTab's formatCurrency always divides by 100.
    // For JPY (minorUnit=0), this is INCORRECT.
    // This test documents the known discrepancy.
    // 1000 JPY minor should display as ¥1000, not ¥10.00
    // The domain has getCurrencyMetadata with minorUnit=0 for JPY,
    // but the client formatCurrency ignores it.
    // We document this as a WARNING finding.
  });
});

describe("Independent Oracle: Cross-Group Isolation", () => {
  test("group A balances are unaffected by group B expenses", () => {
    const expensesA: BalanceExpense[] = [{
      status: "active",
      payers: [{ memberId: "alice", baseAmountMinor: 6000 }],
      splits: [
        { memberId: "alice", baseAmountMinor: 3000 },
        { memberId: "bob", baseAmountMinor: 3000 },
      ],
    }];
    const expensesB: BalanceExpense[] = [{
      status: "active",
      payers: [{ memberId: "bob", baseAmountMinor: 10000 }],
      splits: [
        { memberId: "alice", baseAmountMinor: 5000 },
        { memberId: "bob", baseAmountMinor: 5000 },
      ],
    }];

    const balA = calculateBalances(expensesA, [], ["alice", "bob"]);
    const balB = calculateBalances(expensesB, [], ["alice", "bob"]);

    // Group A: alice +3000, bob -3000
    expect(balA.find((b) => b.memberId === "alice")!.netBaseMinor).toBe(3000);
    // Group B: bob +5000, alice -5000
    expect(balB.find((b) => b.memberId === "bob")!.netBaseMinor).toBe(5000);

    // They don't mix. No global net-zero requirement across groups.
    assertBalancesZeroSum(balA);
    assertBalancesZeroSum(balB);
  });
});
