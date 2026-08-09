export interface CurrencyMetadata {
  code: string;
  minorUnit: number;
  symbol: string;
}

export const CURRENCIES: Record<string, CurrencyMetadata> = {
  USD: { code: "USD", minorUnit: 2, symbol: "$" },
  INR: { code: "INR", minorUnit: 2, symbol: "₹" },
  EUR: { code: "EUR", minorUnit: 2, symbol: "€" },
  GBP: { code: "GBP", minorUnit: 2, symbol: "£" },
  JPY: { code: "JPY", minorUnit: 0, symbol: "¥" },
  CAD: { code: "CAD", minorUnit: 2, symbol: "C$" },
  AUD: { code: "AUD", minorUnit: 2, symbol: "A$" },
  SGD: { code: "SGD", minorUnit: 2, symbol: "S$" },
};

export function getCurrencyMetadata(code: string): CurrencyMetadata {
  const normalized = code.toUpperCase();
  const meta = CURRENCIES[normalized];
  if (!meta) {
    // Default fallback to 2 decimal places
    return { code: normalized, minorUnit: 2, symbol: normalized };
  }
  return meta;
}

export function formatMinorUnit(amountMinor: number, currencyCode: string): string {
  const meta = getCurrencyMetadata(currencyCode);
  const factor = Math.pow(10, meta.minorUnit);
  const mainUnit = amountMinor / factor;
  return `${meta.symbol}${mainUnit.toFixed(meta.minorUnit)}`;
}
