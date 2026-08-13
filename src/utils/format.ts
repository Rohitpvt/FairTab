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

