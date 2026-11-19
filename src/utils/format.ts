import { getCurrencyMetadata } from "@fairtab/domain";

const CURRENCY_LOCALES: Record<string, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
  JPY: "ja-JP",
  CAD: "en-CA",
  AUD: "en-AU",
  SGD: "en-SG",
};

export const formatCurrency = (amountMinor: number, currency = "INR") => {
  const meta = getCurrencyMetadata(currency);
  const factor = Math.pow(10, meta.minorUnit);
  const amount = amountMinor / factor;
  const locale = CURRENCY_LOCALES[currency.toUpperCase()] || "en-US";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency,
    minimumFractionDigits: meta.minorUnit,
    maximumFractionDigits: meta.minorUnit,
  }).format(amount);
};

export const parseTimestamp = (ts: unknown): Date | null => {
  if (!ts) return null;
  try {
    const t = ts as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof t.toDate === "function") {
      const d = t.toDate();
      return isNaN(d.getTime()) ? null : d;
    }
    const secs = typeof t.seconds === "number" ? t.seconds : typeof t._seconds === "number" ? t._seconds : null;
    if (secs !== null) {
      const d = new Date(secs * 1000);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof ts === "string" || typeof ts === "number") {
      const d = new Date(ts);
      return isNaN(d.getTime()) ? null : d;
    }
    if (ts instanceof Date) {
      return isNaN(ts.getTime()) ? null : ts;
    }
  } catch {
    return null;
  }
  return null;
};

export const formatTimestamp = (ts: unknown, includeTime = false): string => {
  const d = parseTimestamp(ts);
  if (!d) return "Just now";
  return includeTime ? d.toLocaleString() : d.toLocaleDateString();
};
