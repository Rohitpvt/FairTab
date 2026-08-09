import { describe, test, expect } from "vitest";
import { calculateBalances, MemberBalance, BalanceExpense, BalanceSettlement } from "./balances.js";
import { simplifyMinimumTransactions, simplifyPreserveRelationships } from "./simplification.js";

describe("Domain Calculations - Balances with Settlements", () => {
  const memberIds = ["alice", "bob", "charlie"];

  test("calculates combined balance correctly with active and voided settlements", () => {
    // Alice paid 150.00, Bob and Charlie split equally (50.00 each)
    const expenses: BalanceExpense[] = [
      {
        status: "active",
        payers: [{ memberId: "alice", baseAmountMinor: 15000 }],
        splits: [
          { memberId: "alice", baseAmountMinor: 5000 },
          { memberId: "bob", baseAmountMinor: 5000 },
          { memberId: "charlie", baseAmountMinor: 5000 },
        ],
      },
    ];

    // Bob settles 30.00 to Alice (active)
    // Charlie settles 50.00 to Alice but it is voided
    const settlements: BalanceSettlement[] = [
      {
        status: "active",
        payerId: "bob",
        receiverId: "alice",
        baseAmountMinor: 3000,
      },
      {
        status: "voided",
        payerId: "charlie",
        receiverId: "alice",
        baseAmountMinor: 5000,
      },
    ];

    // Net balances:
    // Alice: expense net (+100.00) + settlement (+30.00 received => wait, A is receiver! A receives, so A gets -30.00 settlement impact. So Alice net becomes +70.00)
    // Bob: expense net (-50.00) + settlement (+30.00 paid => Bob gets +30.00 settlement impact. So Bob net becomes -20.00)
    // Charlie: expense net (-50.00) + settlement (0 => voided). So Charlie net is -50.00
    // Sum: 70 + (-20) + (-50) = 0.
    const balances = calculateBalances(expenses, settlements, memberIds);

    expect(balances).toEqual([
      { memberId: "alice", netBaseMinor: 7000 },
      { memberId: "bob", netBaseMinor: -2000 },
      { memberId: "charlie", netBaseMinor: -5000 },
    ]);
  });
});

describe("Domain Calculations - Debt Simplification", () => {
  test("simplifyMinimumTransactions matched greedy behavior", () => {
    // alice is owed 90.00, bob is owed 10.00
    // charlie owes 60.00, david owes 40.00
    const balances: MemberBalance[] = [
      { memberId: "alice", netBaseMinor: 9000 },
      { memberId: "bob", netBaseMinor: 1000 },
      { memberId: "charlie", netBaseMinor: -6000 },
      { memberId: "david", netBaseMinor: -4000 },
    ];

    // Greedy strategy:
    // Debtors: charlie (-6000), david (-4000)
    // Creditors: alice (9000), bob (1000)
    // Match largest debtor (charlie) with largest creditor (alice):
    // Transfer min(6000, 9000) = 6000. Charlie pays Alice 6000.
    // Balances become: charlie: 0, alice: 3000
    // Next, debtors: david (-4000). Creditors: alice (3000), bob (1000)
    // Match largest debtor (david) with largest creditor (alice):
    // Transfer min(4000, 3000) = 3000. David pays Alice 3000.
    // Balances become: david: -1000, alice: 0
    // Next, debtors: david (-1000). Creditors: bob (1000).
    // David pays Bob 1000.
    const recs = simplifyMinimumTransactions(balances);

    expect(recs).toEqual([
      { fromMemberId: "charlie", toMemberId: "alice", amountMinor: 6000 },
      { fromMemberId: "david", toMemberId: "alice", amountMinor: 3000 },
      { fromMemberId: "david", toMemberId: "bob", amountMinor: 1000 },
    ]);
  });

  test("simplifyPreserveRelationships tracks direct obligations and netting", () => {
    // Expense 1: Alice paid 90.00, shared equally among Alice, Bob, Charlie (30.00 each)
    // => Bob owes Alice 30.00, Charlie owes Alice 30.00
    // Expense 2: Bob paid 40.00, shared equally among Bob, Charlie (20.00 each)
    // => Charlie owes Bob 20.00
    const expenses: BalanceExpense[] = [
      {
        status: "active",
        payers: [{ memberId: "alice", baseAmountMinor: 9000 }],
        splits: [
          { memberId: "alice", baseAmountMinor: 3000 },
          { memberId: "bob", baseAmountMinor: 3000 },
          { memberId: "charlie", baseAmountMinor: 3000 },
        ],
      },
      {
        status: "active",
        payers: [{ memberId: "bob", baseAmountMinor: 4000 }],
        splits: [
          { memberId: "bob", baseAmountMinor: 2000 },
          { memberId: "charlie", baseAmountMinor: 2000 },
        ],
      },
    ];

    // Settlement: Bob paid Alice 10.00 (active)
    const settlements: BalanceSettlement[] = [
      {
        status: "active",
        payerId: "bob",
        receiverId: "alice",
        baseAmountMinor: 1000,
      },
    ];

    // Initial obligations:
    // Bob owes Alice: 30.00
    // Charlie owes Alice: 30.00
    // Charlie owes Bob: 20.00
    // After Bob settles 10.00 to Alice:
    // Bob owes Alice: 30.00 - 10.00 = 20.00
    // Final recommendations:
    // Bob pays Alice 20.00
    // Charlie pays Alice 30.00
    // Charlie pays Bob 20.00
    const recs = simplifyPreserveRelationships(expenses, settlements, ["alice", "bob", "charlie"]);

    expect(recs).toEqual([
      { fromMemberId: "bob", toMemberId: "alice", amountMinor: 2000 },
      { fromMemberId: "charlie", toMemberId: "alice", amountMinor: 3000 },
      { fromMemberId: "charlie", toMemberId: "bob", amountMinor: 2000 },
    ]);
  });

  test("simplifyPreserveRelationships nets overpayments correctly", () => {
    // Alice paid 30.00, Bob owes Alice 30.00
    const expenses: BalanceExpense[] = [
      {
        status: "active",
        payers: [{ memberId: "alice", baseAmountMinor: 3000 }],
        splits: [
          { memberId: "alice", baseAmountMinor: 0 },
          { memberId: "bob", baseAmountMinor: 3000 },
        ],
      },
    ];

    // Bob settles 40.00 to Alice (overpayment by 10.00)
    const settlements: BalanceSettlement[] = [
      {
        status: "active",
        payerId: "bob",
        receiverId: "alice",
        baseAmountMinor: 4000,
      },
    ];

    // Initial: Bob owes Alice 30.00
    // Settlement: 40.00 paid. Bob owes Alice 30.00 - 40.00 = -10.00 (Alice owes Bob 10.00)
    // Final: Alice owes Bob 10.00
    const recs = simplifyPreserveRelationships(expenses, settlements, ["alice", "bob"]);

    expect(recs).toEqual([
      { fromMemberId: "alice", toMemberId: "bob", amountMinor: 1000 },
    ]);
  });
});
