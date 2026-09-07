import { describe, test, expect } from "vitest";
import { formatCurrency } from "../utils/format";

describe("Remediation: Dynamic Currency Formatting Regression Tests", () => {
  test("INR formatting - scales by 100 and retains 2 decimals", () => {
    // 1000 minor units of INR is 10.00 Rupees
    const formatted = formatCurrency(1000, "INR");
    expect(formatted).toContain("10.00");
    expect(formatted).toContain("₹");
  });

  test("USD formatting - scales by 100 and retains 2 decimals", () => {
    // 1000 minor units of USD is 10.00 Dollars
    const formatted = formatCurrency(1000, "USD");
    expect(formatted).toContain("10.00");
    expect(formatted).toContain("$");
  });

  test("JPY formatting - scales by 1 (no decimals) and formats correctly", () => {
    // JPY minor unit is 0. So 1000 minor units represents 1000 Yen
    const formatted = formatCurrency(1000, "JPY");
    
    // It should contain 1,000 without decimal portion
    expect(formatted).toContain("1,000");
    expect(formatted).not.toContain("10.00");
    expect(formatted).not.toContain(".00");
    
    // Check for either '¥' or 'JP¥' depending on system locale format representation
    const hasJpySymbol = formatted.includes("¥") || formatted.includes("JP¥");
    expect(hasJpySymbol).toBe(true);
  });
});

describe("formatTimestamp Utility Tests", () => {
  test("handles null or undefined gracefully", async () => {
    const { formatTimestamp } = await import("../utils/format");
    expect(formatTimestamp(null)).toBe("Just now");
    expect(formatTimestamp(undefined)).toBe("Just now");
  });

  test("handles Firestore Timestamp instance with .toDate()", async () => {
    const { formatTimestamp } = await import("../utils/format");
    const mockTimestamp = {
      toDate: () => new Date("2026-05-15T10:30:00Z"),
    };
    const result = formatTimestamp(mockTimestamp);
    expect(result).toBe(new Date("2026-05-15T10:30:00Z").toLocaleDateString());
  });

  test("handles Firestore POJO with seconds and nanoseconds", async () => {
    const { formatTimestamp } = await import("../utils/format");
    const pojoTimestamp = { seconds: 1778841000, nanoseconds: 0 };
    const result = formatTimestamp(pojoTimestamp);
    expect(result).toBe(new Date(1778841000 * 1000).toLocaleDateString());
  });

  test("handles standard ISO date string or number timestamp", async () => {
    const { formatTimestamp } = await import("../utils/format");
    const isoString = "2026-08-10T12:00:00Z";
    expect(formatTimestamp(isoString)).toBe(new Date(isoString).toLocaleDateString());

    const epochMs = 1778841000000;
    expect(formatTimestamp(epochMs)).toBe(new Date(epochMs).toLocaleDateString());
  });

  test("handles corrupted/unknown input without throwing", async () => {
    const { formatTimestamp } = await import("../utils/format");
    expect(formatTimestamp({})).toBe("Recently");
    expect(formatTimestamp("invalid-date-string-xyz")).toBe("Recently");
  });
});

