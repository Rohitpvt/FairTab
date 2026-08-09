/**
 * Unit tests for the pro-rata largest-remainder allocation logic.
 *
 * Tests the pure `allocateLargestRemainder` function exported from
 * TaxTipAllocator.tsx.  Verifies:
 *   • Sum of allocations always equals the total to allocate (cent-perfect)
 *   • Deterministic tie-breaking via alphabetical memberId
 *   • Edge cases: zero total, zero subtotal, single member, large remainder
 */
import { describe, test, expect } from "vitest";
import { allocateLargestRemainder } from "../features/receipts/TaxTipAllocator";

describe("allocateLargestRemainder", () => {

  // ---------- Basic correctness ----------

  test("allocates proportionally and sums to totalToAllocate", () => {
    // Three members: A=3000, B=5000, C=2000 of 10000 subtotal
    // Allocating 1000 (tax) → A=300, B=500, C=200
    const result = allocateLargestRemainder(1000, 10000, {
      alice: 3000,
      bob: 5000,
      charlie: 2000,
    });

    expect(result.alice).toBe(300);
    expect(result.bob).toBe(500);
    expect(result.charlie).toBe(200);

    const sum = Object.values(result).reduce((a, b) => a + b, 0);
    expect(sum).toBe(1000);
  });

  test("distributes remainder cents to members with largest fractional parts", () => {
    // 3 members each with subtotal share 100 out of 300.
    // Allocating 10 cents: raw = 3.333... each → floor 3, remainder 1 cent.
    // Remainder goes to first by alphabetical tie-break.
    const result = allocateLargestRemainder(10, 300, {
      alice: 100,
      bob: 100,
      charlie: 100,
    });

    const sum = Object.values(result).reduce((a, b) => a + b, 0);
    expect(sum).toBe(10);
    // 10/3 = 3.333… each. Floors = 3+3+3=9. 1 remainder cent.
    // All remainders are equal (0.333…), tie-break alphabetical → alice gets it.
    expect(result.alice).toBe(4);
    expect(result.bob).toBe(3);
    expect(result.charlie).toBe(3);
  });

  test("stable alphabetical tie-breaking is deterministic", () => {
    // Two members with equal shares. 1 remainder cent always goes to
    // the alphabetically first member.
    const result = allocateLargestRemainder(7, 200, {
      zara: 100,
      alice: 100,
    });

    const sum = Object.values(result).reduce((a, b) => a + b, 0);
    expect(sum).toBe(7);
    // 7/2 = 3.5 each → floor 3, remainder 1 cent. alice < zara → alice gets it.
    expect(result.alice).toBe(4);
    expect(result.zara).toBe(3);
  });

  // ---------- Edge cases ----------

  test("zero totalToAllocate returns zero for each member", () => {
    const result = allocateLargestRemainder(0, 1000, {
      alice: 500,
      bob: 500,
    });

    expect(result.alice).toBe(0);
    expect(result.bob).toBe(0);
  });

  test("zero totalSubtotal splits evenly with remainder to first members", () => {
    // When subtotal is 0 the function falls back to even split.
    const result = allocateLargestRemainder(10, 0, {
      alice: 0,
      bob: 0,
      charlie: 0,
    });

    const sum = Object.values(result).reduce((a, b) => a + b, 0);
    expect(sum).toBe(10);
    // 10 / 3 = 3 + remainder 1.  Alphabetical: alice gets it.
    expect(result.alice).toBe(4);
    expect(result.bob).toBe(3);
    expect(result.charlie).toBe(3);
  });

  test("single member receives the full amount", () => {
    const result = allocateLargestRemainder(9999, 5000, {
      solo: 5000,
    });

    expect(result.solo).toBe(9999);
  });

  test("empty shares returns empty object", () => {
    const result = allocateLargestRemainder(100, 0, {});
    expect(Object.keys(result).length).toBe(0);
  });

  test("unequal shares distribute remainder correctly", () => {
    // alice=1 out of 3, bob=2 out of 3.
    // Allocating 100: alice raw=33.33, bob raw=66.66
    // Floors: 33+66=99, remainder 1 cent.
    // alice remainder=0.33, bob remainder=0.66 → bob gets the extra cent.
    const result = allocateLargestRemainder(100, 3, {
      alice: 1,
      bob: 2,
    });

    expect(result.alice).toBe(33);
    expect(result.bob).toBe(67);
    expect(result.alice + result.bob).toBe(100);
  });

  test("large allocation with many members sums exactly", () => {
    const shares: Record<string, number> = {};
    for (let i = 0; i < 20; i++) {
      shares[`member_${String(i).padStart(2, "0")}`] = 100 + i;
    }
    const subtotal = Object.values(shares).reduce((a, b) => a + b, 0);
    const totalToAllocate = 12345;

    const result = allocateLargestRemainder(totalToAllocate, subtotal, shares);
    const sum = Object.values(result).reduce((a, b) => a + b, 0);
    expect(sum).toBe(totalToAllocate);
  });

  test("all values are non-negative integers", () => {
    const result = allocateLargestRemainder(7, 300, {
      alice: 100,
      bob: 100,
      charlie: 100,
    });

    Object.values(result).forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(v)).toBe(true);
    });
  });

  // ---------- Regression: item subtotal + tax + tip - discount == receipt total ----------

  test("reconciliation: total of all member allocations equals receipt total", () => {
    const subtotal = 5000;   // $50.00
    const tax = 450;         // $4.50
    const tip = 1000;        // $10.00
    const discount = 200;    // $2.00
    const receiptTotal = subtotal + tax + tip - discount; // 6250

    const shares: Record<string, number> = { alice: 2000, bob: 2000, charlie: 1000 };

    const taxAlloc = allocateLargestRemainder(tax, subtotal, shares);
    const tipAlloc = allocateLargestRemainder(tip, subtotal, shares);
    const discAlloc = allocateLargestRemainder(discount, subtotal, shares);

    // Sum up each member's total: base + tax + tip - discount
    let grandTotal = 0;
    for (const id of Object.keys(shares)) {
      const memberTotal = shares[id] + (taxAlloc[id] || 0) + (tipAlloc[id] || 0) - (discAlloc[id] || 0);
      grandTotal += memberTotal;
    }

    expect(grandTotal).toBe(receiptTotal);

    // Also verify each individual allocation sums correctly
    expect(Object.values(taxAlloc).reduce((a, b) => a + b, 0)).toBe(tax);
    expect(Object.values(tipAlloc).reduce((a, b) => a + b, 0)).toBe(tip);
    expect(Object.values(discAlloc).reduce((a, b) => a + b, 0)).toBe(discount);
  });
});
