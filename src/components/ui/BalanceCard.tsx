import React from "react";
import { ArrowUpRight, ArrowDownLeft, CheckCircle2 } from "lucide-react";
import { GlassPanel } from "./GlassPanel";
import { formatCurrency } from "../../utils/format";

export interface BalanceCardProps extends React.HTMLAttributes<HTMLDivElement> {
  amountMinor: number;
  currency?: string;
  label?: string;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  amountMinor,
  currency = "INR",
  label,
  className = "",
  ...props
}) => {
  const isPositive = amountMinor > 0;
  const isNegative = amountMinor < 0;
  const isSettled = amountMinor === 0;

  // Set colors based on state
  let cardTitle = label || "Net Balance";
  let statusColor = "text-text-primary";
  let Icon = CheckCircle2;

  if (isPositive) {
    cardTitle = label || "You are owed";
    statusColor = "text-success";
    Icon = ArrowUpRight;
  } else if (isNegative) {
    cardTitle = label || "You owe";
    statusColor = "text-danger";
    Icon = ArrowDownLeft;
  } else if (isSettled) {
    cardTitle = label || "Settled Up";
    statusColor = "text-text-muted";
    Icon = CheckCircle2;
  }

  const absoluteAmount = Math.abs(amountMinor);

  return (
    <GlassPanel
      variant="standard"
      className={`relative overflow-hidden border border-border-color bg-surface-primary/90 flex items-center justify-between p-5 sm:p-6 rounded-2xl ${className}`}
      {...props}
    >
      <div className="flex flex-col gap-1.5 z-10">
        <span className="text-text-muted text-xs font-semibold uppercase tracking-wider">
          {cardTitle}
        </span>
        <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${statusColor} financial-number`}>
          {formatCurrency(isNegative ? absoluteAmount : amountMinor, currency)}
        </span>
      </div>
      <div className={`p-3 rounded-xl bg-surface-secondary border border-border-color/60 ${statusColor} z-10`}>
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
      </div>
    </GlassPanel>
  );
};
