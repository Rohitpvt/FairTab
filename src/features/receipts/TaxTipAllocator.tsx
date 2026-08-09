/* eslint-disable react-refresh/only-export-components */
import React from "react";

/**
 * Distribute an amount using the largest-remainder method with stable member ID tie-breaking.
 */
export function allocateLargestRemainder(
  totalToAllocate: number,
  totalSubtotal: number,
  shares: Record<string, number>
): Record<string, number> {
  const result: Record<string, number> = {};
  if (totalToAllocate === 0) {
    Object.keys(shares).forEach((id) => { result[id] = 0; });
    return result;
  }
  if (totalSubtotal === 0) {
    // If subtotal is 0, split evenly
    const memberIds = Object.keys(shares).sort();
    const count = memberIds.length;
    if (count === 0) return result;
    
    const base = Math.floor(totalToAllocate / count);
    const remainder = totalToAllocate % count;
    memberIds.forEach((id, idx) => {
      result[id] = base + (idx < remainder ? 1 : 0);
    });
    return result;
  }

  const memberIds = Object.keys(shares);
  let allocatedSum = 0;
  const items: { memberId: string; floor: number; remainder: number }[] = [];

  memberIds.forEach((memberId) => {
    const userSubtotal = shares[memberId];
    const rawShare = (totalToAllocate * userSubtotal) / totalSubtotal;
    const floor = Math.floor(rawShare);
    const remainder = rawShare - floor;
    
    allocatedSum += floor;
    items.push({ memberId, floor, remainder });
  });

  const remainingCents = totalToAllocate - allocatedSum;

  // Sort by remainder descending, break ties stably using memberId alphabetically ascending
  items.sort((a, b) => {
    if (Math.abs(a.remainder - b.remainder) > 0.000001) {
      return b.remainder - a.remainder;
    }
    return a.memberId.localeCompare(b.memberId);
  });

  items.forEach((item, index) => {
    let cents = item.floor;
    if (index < remainingCents) {
      cents += 1;
    }
    result[item.memberId] = cents;
  });

  return result;
}

interface TaxTipAllocatorProps {
  subtotal: number;
  tax: number;
  tip: number;
  discount: number;
  total: number;
  shares: Record<string, number>; // memberId -> items subtotal share
  onAllocationChange?: (allocation: Record<string, { base: number; tax: number; tip: number; discount: number; total: number }>) => void;
}

export const TaxTipAllocator: React.FC<TaxTipAllocatorProps> = ({
  subtotal,
  tax,
  tip,
  discount,
  total,
  shares,
  onAllocationChange,
}) => {
  const memberIds = Object.keys(shares).sort();
  
  // Calculate allocations
  const taxAllocation = allocateLargestRemainder(tax, subtotal, shares);
  const tipAllocation = allocateLargestRemainder(tip, subtotal, shares);
  const discountAllocation = allocateLargestRemainder(discount, subtotal, shares);

  const allocations = React.useMemo(() => {
    const alloc: Record<string, { base: number; tax: number; tip: number; discount: number; total: number }> = {};
    memberIds.forEach((id) => {
      const base = shares[id];
      const t = taxAllocation[id] || 0;
      const tp = tipAllocation[id] || 0;
      const d = discountAllocation[id] || 0;
      alloc[id] = {
        base,
        tax: t,
        tip: tp,
        discount: d,
        total: base + t + tp - d,
      };
    });
    return alloc;
  }, [shares, taxAllocation, tipAllocation, discountAllocation, memberIds]);

  React.useEffect(() => {
    if (onAllocationChange) {
      onAllocationChange(allocations);
    }
  }, [allocations, onAllocationChange]);

  const totalCalculated = memberIds.reduce((sum, id) => sum + (allocations[id]?.total || 0), 0);
  const discrepancy = total - totalCalculated;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-white/80">Pro-rata Tax & Tip Allocation</h3>
      <div className="overflow-x-auto border border-white/10 rounded-lg">
        <table className="min-w-full divide-y divide-white/10 text-left text-xs">
          <thead className="bg-white/5 text-white/60">
            <tr>
              <th className="px-4 py-2 font-medium">Participant ID</th>
              <th className="px-4 py-2 font-medium text-right">Items Share</th>
              <th className="px-4 py-2 font-medium text-right">Tax</th>
              <th className="px-4 py-2 font-medium text-right">Tip</th>
              <th className="px-4 py-2 font-medium text-right">Discount</th>
              <th className="px-4 py-2 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 text-white/80">
            {memberIds.map((id) => {
              const item = allocations[id];
              return (
                <tr key={id} className="hover:bg-white/5">
                  <td className="px-4 py-2 font-mono">{id}</td>
                  <td className="px-4 py-2 text-right">{(item.base / 100).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right text-amber-300">+{(item.tax / 100).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right text-emerald-400">+{(item.tip / 100).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right text-rose-400">-{(item.discount / 100).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-semibold">{(item.total / 100).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {discrepancy !== 0 && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs">
          ⚠️ Discrepancy detected: Reconciler difference is {(discrepancy / 100).toFixed(2)}. Make sure items + tax + tip - discount matches total.
        </div>
      )}
    </div>
  );
};
