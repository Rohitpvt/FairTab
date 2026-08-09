export interface SplitResult {
  memberId: string;
  amountMinor: number;
}

export function splitEqual(
  amountMinor: number,
  participantIds: string[],
  residualRecipientId?: string
): SplitResult[] {
  if (participantIds.length === 0) {
    throw new Error("Cannot split among zero participants");
  }

  // Stable sort participant IDs alphabetically
  const sortedIds = [...participantIds].sort();
  const N = sortedIds.length;
  const baseAmount = Math.floor(amountMinor / N);
  const remainder = amountMinor % N;

  const results: SplitResult[] = sortedIds.map((memberId) => {
    return { memberId, amountMinor: baseAmount };
  });

  if (remainder > 0) {
    if (residualRecipientId && sortedIds.includes(residualRecipientId)) {
      const idx = results.findIndex((r) => r.memberId === residualRecipientId);
      if (idx !== -1) {
        results[idx].amountMinor += remainder;
      }
    } else {
      // Distribute 1 minor unit each to the first 'remainder' participants in stable sorted list
      for (let i = 0; i < remainder; i++) {
        results[i].amountMinor += 1;
      }
    }
  }

  return results;
}

export function splitExact(
  amountMinor: number,
  allocations: Record<string, number>
): SplitResult[] {
  let totalAllocated = 0;
  const results: SplitResult[] = [];

  for (const [memberId, amount] of Object.entries(allocations)) {
    if (amount < 0 || !Number.isSafeInteger(amount)) {
      throw new Error(`Invalid allocation amount for member ${memberId}`);
    }
    totalAllocated += amount;
    results.push({ memberId, amountMinor: amount });
  }

  if (totalAllocated !== amountMinor) {
    throw new Error(
      `Exact split total ${totalAllocated} does not equal expense amount ${amountMinor}`
    );
  }

  return results.sort((a, b) => a.memberId.localeCompare(b.memberId));
}

export function splitPercentage(
  amountMinor: number,
  percentagesBps: Record<string, number>,
  participantIds: string[]
): SplitResult[] {
  if (participantIds.length === 0) {
    throw new Error("Cannot split among zero participants");
  }

  let totalBps = 0;
  const sortedIds = [...participantIds].sort();

  for (const memberId of sortedIds) {
    const bps = percentagesBps[memberId] ?? 0;
    if (bps < 0 || !Number.isSafeInteger(bps)) {
      throw new Error(`Invalid percentage basis points for member ${memberId}`);
    }
    totalBps += bps;
  }

  if (totalBps !== 10000) {
    throw new Error(`Total percentage basis points must equal 10000 (actual: ${totalBps})`);
  }

  interface PercentageItem {
    memberId: string;
    baseAmount: number;
    remainder: number;
  }

  const items: PercentageItem[] = sortedIds.map((memberId) => {
    const bps = percentagesBps[memberId] ?? 0;
    const baseVal = Math.floor((amountMinor * bps) / 10000);
    const rem = (amountMinor * bps) % 10000;
    return { memberId, baseAmount: baseVal, remainder: rem };
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

  return sortedIds.map((memberId) => ({
    memberId,
    amountMinor: allocatedMap[memberId],
  }));
}

export function splitShares(
  amountMinor: number,
  shares: Record<string, number>,
  participantIds: string[]
): SplitResult[] {
  if (participantIds.length === 0) {
    throw new Error("Cannot split among zero participants");
  }

  const sortedIds = [...participantIds].sort();
  let totalShares = 0;

  for (const memberId of sortedIds) {
    const s = shares[memberId] ?? 0;
    if (s < 0 || !Number.isSafeInteger(s)) {
      throw new Error(`Invalid shares count for member ${memberId}`);
    }
    totalShares += s;
  }

  if (totalShares === 0) {
    throw new Error("Total shares must be greater than zero");
  }

  interface ShareItem {
    memberId: string;
    baseAmount: number;
    remainder: number;
  }

  const items: ShareItem[] = sortedIds.map((memberId) => {
    const s = shares[memberId] ?? 0;
    const baseVal = Math.floor((amountMinor * s) / totalShares);
    const rem = (amountMinor * s) % totalShares;
    return { memberId, baseAmount: baseVal, remainder: rem };
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

  return sortedIds.map((memberId) => ({
    memberId,
    amountMinor: allocatedMap[memberId],
  }));
}
