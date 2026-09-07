import { getCurrencyMetadata } from "@fairtab/domain";

export const formatCurrency = (amountMinor: number, currency = "INR") => {
  const meta = getCurrencyMetadata(currency);
  const factor = Math.pow(10, meta.minorUnit);
  const amount = amountMinor / factor;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: meta.minorUnit,
    maximumFractionDigits: meta.minorUnit,
  }).format(amount);
};

export const formatTimestamp = (ts: unknown, includeTime = false): string => {
  if (!ts) return "Just now";
  try {
    const t = ts as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof t.toDate === "function") {
      const d = t.toDate();
      return includeTime ? d.toLocaleString() : d.toLocaleDateString();
    }
    const secs = typeof t.seconds === "number" ? t.seconds : typeof t._seconds === "number" ? t._seconds : null;
    if (secs !== null) {
      const d = new Date(secs * 1000);
      return includeTime ? d.toLocaleString() : d.toLocaleDateString();
    }
    if (typeof ts === "string" || typeof ts === "number") {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
        return includeTime ? d.toLocaleString() : d.toLocaleDateString();
      }
    }
    if (ts instanceof Date && !isNaN(ts.getTime())) {
      return includeTime ? ts.toLocaleString() : ts.toLocaleDateString();
    }
  } catch (e) {
    console.warn("Error formatting timestamp:", e);
  }
  return "Recently";
};
