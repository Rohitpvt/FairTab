export interface CurrencyMetadata {
  code: string;
  name: string;
  minorUnit: number;
  symbol: string;
}

export const CURRENCIES: Record<string, CurrencyMetadata> = {
  INR: { code: "INR", name: "Indian Rupee (₹)", minorUnit: 2, symbol: "₹" },
  USD: { code: "USD", name: "US Dollar ($)", minorUnit: 2, symbol: "$" },
  EUR: { code: "EUR", name: "Euro (€)", minorUnit: 2, symbol: "€" },
  GBP: { code: "GBP", name: "British Pound (£)", minorUnit: 2, symbol: "£" },
  JPY: { code: "JPY", name: "Japanese Yen (¥)", minorUnit: 0, symbol: "¥" },
  CAD: { code: "CAD", name: "Canadian Dollar (C$)", minorUnit: 2, symbol: "C$" },
  AUD: { code: "AUD", name: "Australian Dollar (A$)", minorUnit: 2, symbol: "A$" },
  SGD: { code: "SGD", name: "Singapore Dollar (S$)", minorUnit: 2, symbol: "S$" },
};

export const CURRENCY_LIST: CurrencyMetadata[] = Object.values(CURRENCIES);

export function getCurrencyMetadata(code: string): CurrencyMetadata {
  const normalized = code.toUpperCase();
  const meta = CURRENCIES[normalized];
  if (!meta) {
    return { code: normalized, name: `${normalized} (${normalized})`, minorUnit: 2, symbol: normalized };
  }
  return meta;
}

export function formatMinorUnit(amountMinor: number, currencyCode: string): string {
  const meta = getCurrencyMetadata(currencyCode);
  const factor = Math.pow(10, meta.minorUnit);
  const mainUnit = amountMinor / factor;
  return `${meta.symbol}${mainUnit.toFixed(meta.minorUnit)}`;
}
