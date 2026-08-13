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
