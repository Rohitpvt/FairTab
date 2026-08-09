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
  let bgGradient = "from-white/5 to-white/[0.02]";

  if (isPositive) {
    cardTitle = label || "You are owed";
    statusColor = "text-success";
    Icon = ArrowUpRight;
    bgGradient = "from-success/5 to-transparent";
  } else if (isNegative) {
    cardTitle = label || "You owe";
    statusColor = "text-danger";
    Icon = ArrowDownLeft;
    bgGradient = "from-danger/5 to-transparent";
  } else if (isSettled) {
    cardTitle = label || "Settled Up";
    statusColor = "text-text-muted";
    Icon = CheckCircle2;
  }

  const absoluteAmount = Math.abs(amountMinor);

  return (
    <GlassPanel
      variant="standard"
      className={`relative overflow-hidden bg-gradient-to-br ${bgGradient} flex items-center justify-between p-6 ${className}`}
      {...props}
    >
      <div className="flex flex-col gap-1.5 z-10">
        <span className="text-text-muted text-xs font-semibold uppercase tracking-wider">
          {cardTitle}
        </span>
        <span className={`text-3xl font-extrabold tracking-tight ${statusColor} financial-number`}>
          {formatCurrency(isNegative ? absoluteAmount : amountMinor, currency)}
        </span>
      </div>
      <div className={`p-3 rounded-xl glass-subtle ${statusColor} z-10`}>
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
    </GlassPanel>
  );
};
