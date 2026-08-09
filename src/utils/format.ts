export const formatCurrency = (amountMinor: number, currency = "INR") => {
  const amount = amountMinor / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount);
};
