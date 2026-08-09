import type { MemberBalance, BalanceExpense, BalanceSettlement } from "./balances.js";

export interface DebtRecommendation {
  fromMemberId: string; // debtor
  toMemberId: string; // creditor
  amountMinor: number;
}

/**
 * Deterministic greedy debt simplification strategy.
 * Matches the largest debtor with the largest creditor to minimize transactions.
 * Note: A greedy matching strategy is not mathematically guaranteed to find the absolute
 * global minimum transaction count in every case (which is NP-complete), but it behaves
 * deterministically and is documented as a greedy heuristic simplification.
 */
export function simplifyMinimumTransactions(balances: MemberBalance[]): DebtRecommendation[] {
  // Create a copy of balances, filtering out zero balances
  const workingBalances = balances
    .map((b) => ({ memberId: b.memberId, balance: b.netBaseMinor }))
    .filter((b) => b.balance !== 0);

  const recommendations: DebtRecommendation[] = [];

  while (true) {
    const debtors = workingBalances.filter((m) => m.balance < 0);
    const creditors = workingBalances.filter((m) => m.balance > 0);

    if (debtors.length === 0 || creditors.length === 0) {
      break;
    }

    // Sort debtors ascending (largest debt first, e.g. -5000 before -3000)
    debtors.sort((a, b) => {
      if (a.balance !== b.balance) {
        return a.balance - b.balance;
      }
      return a.memberId.localeCompare(b.memberId);
    });

    // Sort creditors descending (largest credit first, e.g. 5000 before 3000)
    creditors.sort((a, b) => {
      if (a.balance !== b.balance) {
        return b.balance - a.balance;
      }
      return a.memberId.localeCompare(b.memberId);
    });

    const debtor = debtors[0];
    const creditor = creditors[0];

    const debtAmount = Math.abs(debtor.balance);
    const creditAmount = creditor.balance;

    const transfer = Math.min(debtAmount, creditAmount);
    if (transfer > 0) {
      recommendations.push({
        fromMemberId: debtor.memberId,
        toMemberId: creditor.memberId,
        amountMinor: transfer,
      });

      debtor.balance += transfer;
      creditor.balance -= transfer;
    }

    // Clean up members with zero balance
    for (let i = workingBalances.length - 1; i >= 0; i--) {
      if (workingBalances[i].balance === 0) {
        workingBalances.splice(i, 1);
      }
    }
  }

  return recommendations;
}

/**
 * Helper proportional division function.
 * Splits amountMinor proportionally among creditors using stable remainder allocation.
 */
function splitProportional(
  amountMinor: number,
  creditors: { memberId: string; credit: number }[]
): { memberId: string; amountMinor: number }[] {
  const totalShares = creditors.reduce((sum, c) => sum + c.credit, 0);
  if (totalShares === 0 || amountMinor === 0) {
    return creditors.map((c) => ({ memberId: c.memberId, amountMinor: 0 }));
  }

  const items = creditors.map((c) => {
    const baseVal = Math.floor((amountMinor * c.credit) / totalShares);
    const rem = (amountMinor * c.credit) % totalShares;
    return { memberId: c.memberId, baseAmount: baseVal, remainder: rem };
  });

  const sumBase = items.reduce((sum, item) => sum + item.baseAmount, 0);
  const residual = amountMinor - sumBase;

  // Sort by remainder descending, then by memberId ascending as tie-breaker
  const sortedItems = [...items].sort((a, b) => {
    if (b.remainder !== a.remainder) {
      return b.remainder - a.remainder;
    }
    return a.memberId.localeCompare(b.memberId);
  });

  const allocatedMap: Record<string, number> = {};
  items.forEach((item) => {
    allocatedMap[item.memberId] = item.baseAmount;
  });

  for (let i = 0; i < residual; i++) {
    const target = sortedItems[i % sortedItems.length];
    allocatedMap[target.memberId] += 1;
  }

  return creditors.map((c) => ({
    memberId: c.memberId,
    amountMinor: allocatedMap[c.memberId],
  }));
}

/**
 * Preserve Relationships debt simplification strategy.
 * Maps individual expense debts to pairwise obligations, then subtracts settlements,
 * and nets them pairwise to preserve direct relationships.
 */
export function simplifyPreserveRelationships(
  expenses: BalanceExpense[],
  settlements: BalanceSettlement[],
  memberIds: string[]
): DebtRecommendation[] {
  // Initialize obligation matrix: matrix[u][v] = amount member u owes member v
  const matrix: Record<string, Record<string, number>> = {};
  for (const u of memberIds) {
    matrix[u] = {};
    for (const v of memberIds) {
      matrix[u][v] = 0;
    }
  }

  // 1. Process active expenses to build pairwise obligations
  for (const exp of expenses) {
    if (exp.status !== "active") {
      continue;
    }

    // Calculate net contribution of each member inside this expense
    const contributionMap: Record<string, number> = {};
    for (const memberId of memberIds) {
      contributionMap[memberId] = 0;
    }

    for (const payer of exp.payers) {
      if (contributionMap[payer.memberId] !== undefined) {
        contributionMap[payer.memberId] += payer.baseAmountMinor;
      }
    }

    for (const split of exp.splits) {
      if (contributionMap[split.memberId] !== undefined) {
        contributionMap[split.memberId] -= split.baseAmountMinor;
      }
    }

    // Separate debtors and creditors for this expense
    const expenseDebtors = memberIds
      .filter((m) => contributionMap[m] < 0)
      .map((m) => ({ memberId: m, debt: Math.abs(contributionMap[m]) }));

    const expenseCreditors = memberIds
      .filter((m) => contributionMap[m] > 0)
      .map((m) => ({ memberId: m, credit: contributionMap[m] }));

    // Proportionally split each debtor's obligation among creditors
    for (const debtor of expenseDebtors) {
      const splits = splitProportional(debtor.debt, expenseCreditors);
      for (const split of splits) {
        if (split.amountMinor > 0) {
          matrix[debtor.memberId][split.memberId] += split.amountMinor;
        }
      }
    }
  }

  // 2. Process active settlements to reduce obligations
  for (const set of settlements) {
    if (set.status !== "active") {
      continue;
    }

    // Settlement: set.payerId paid set.receiverId set.baseAmountMinor.
    // This reduces what set.payerId owes set.receiverId.
    matrix[set.payerId][set.receiverId] -= set.baseAmountMinor;

    // If overpaid, the receiver now owes the payer the surplus
    if (matrix[set.payerId][set.receiverId] < 0) {
      const overpaidAmount = Math.abs(matrix[set.payerId][set.receiverId]);
      matrix[set.receiverId][set.payerId] += overpaidAmount;
      matrix[set.payerId][set.receiverId] = 0;
    }
  }

  // 3. Perform pairwise netting & recommend
  const recommendations: DebtRecommendation[] = [];
  const sortedIds = [...memberIds].sort();

  for (let i = 0; i < sortedIds.length; i++) {
    for (let j = i + 1; j < sortedIds.length; j++) {
      const u = sortedIds[i];
      const v = sortedIds[j];

      const uOwesV = matrix[u][v];
      const vOwesU = matrix[v][u];

      if (uOwesV > vOwesU) {
        const net = uOwesV - vOwesU;
        if (net > 0) {
          recommendations.push({
            fromMemberId: u,
            toMemberId: v,
            amountMinor: net,
          });
        }
      } else if (vOwesU > uOwesV) {
        const net = vOwesU - uOwesV;
        if (net > 0) {
          recommendations.push({
            fromMemberId: v,
            toMemberId: u,
            amountMinor: net,
          });
        }
      }
    }
  }

  // Stable sort recommendations for deterministic output
  return recommendations.sort((a, b) => {
    if (a.fromMemberId !== b.fromMemberId) {
      return a.fromMemberId.localeCompare(b.fromMemberId);
    }
    return a.toMemberId.localeCompare(b.toMemberId);
  });
}
