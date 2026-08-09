export interface BalancePayer {
  memberId: string;
  baseAmountMinor: number;
}

export interface BalanceSplit {
  memberId: string;
  baseAmountMinor: number;
}

export interface BalanceExpense {
  status: "active" | "voided";
  payers: BalancePayer[];
  splits: BalanceSplit[];
}

export interface BalanceSettlement {
  status: "active" | "voided";
  payerId: string;
  receiverId: string;
  baseAmountMinor: number;
}

export interface MemberBalance {
  memberId: string;
  netBaseMinor: number;
}

export function calculateBalances(
  expenses: BalanceExpense[],
  settlementsOrMemberIds: BalanceSettlement[] | string[],
  memberIds?: string[]
): MemberBalance[] {
  let actualSettlements: BalanceSettlement[];
  let actualMemberIds: string[];

  if (memberIds !== undefined) {
    actualSettlements = settlementsOrMemberIds as BalanceSettlement[];
    actualMemberIds = memberIds;
  } else {
    actualSettlements = [];
    actualMemberIds = settlementsOrMemberIds as string[];
  }

  const balanceMap: Record<string, number> = {};

  // Initialize all members with zero balances
  for (const memberId of actualMemberIds) {
    balanceMap[memberId] = 0;
  }

  // Process only active expenses
  for (const exp of expenses) {
    if (exp.status !== "active") {
      continue;
    }

    // Add paid amounts (for payers)
    for (const payer of exp.payers) {
      if (balanceMap[payer.memberId] !== undefined) {
        balanceMap[payer.memberId] += payer.baseAmountMinor;
      }
    }

    // Subtract owed amounts (for splits)
    for (const split of exp.splits) {
      if (balanceMap[split.memberId] !== undefined) {
        balanceMap[split.memberId] -= split.baseAmountMinor;
      }
    }
  }

  // Process only active settlements
  for (const set of actualSettlements) {
    if (set.status !== "active") {
      continue;
    }

    // Payer (sender) of settlement gets +baseAmountMinor
    if (balanceMap[set.payerId] !== undefined) {
      balanceMap[set.payerId] += set.baseAmountMinor;
    }

    // Receiver (recipient) gets -baseAmountMinor
    if (balanceMap[set.receiverId] !== undefined) {
      balanceMap[set.receiverId] -= set.baseAmountMinor;
    }
  }

  // Convert to output array sorted by member ID
  const balances: MemberBalance[] = Object.keys(balanceMap)
    .sort()
    .map((memberId) => ({
      memberId,
      netBaseMinor: balanceMap[memberId],
    }));

  // Double check zero-sum invariant
  let sum = 0;
  for (const b of balances) {
    sum += b.netBaseMinor;
  }

  if (sum !== 0) {
    throw new Error(`Sanity Check Failed: Sum of all member balances is not zero (sum = ${sum})`);
  }

  return balances;
}
