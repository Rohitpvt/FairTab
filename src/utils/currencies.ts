export interface CurrencyMetadata {
  code: string;
  name: string;
  symbol: string;
}

export const CURRENCIES: CurrencyMetadata[] = [
  { code: "INR", name: "Indian Rupee (₹)", symbol: "₹" },
  { code: "USD", name: "US Dollar ($)", symbol: "$" },
  { code: "EUR", name: "Euro (€)", symbol: "€" },
  { code: "GBP", name: "British Pound (£)", symbol: "£" },
  { code: "JPY", name: "Japanese Yen (¥)", symbol: "¥" },
  { code: "CAD", name: "Canadian Dollar (C$)", symbol: "C$" },
  { code: "AUD", name: "Australian Dollar (A$)", symbol: "A$" }
];

export default CURRENCIES;
