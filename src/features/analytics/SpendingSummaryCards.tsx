import React from "react";
import { StatCard } from "../../components/ui/StatCard";
import { DollarSign, Wallet, Star, CalendarDays } from "lucide-react";
import type { SpendingSummary } from "@fairtab/domain";

interface SpendingSummaryCardsProps {
  summary: SpendingSummary;
  currency: string;
  formatAmount: (minor: number) => string;
}

export const SpendingSummaryCards: React.FC<SpendingSummaryCardsProps> = ({
  summary,
  formatAmount,
}) => {
  const recurringPercent = summary.totalExpensesMinor > 0 
    ? Math.round((summary.recurringMinor / summary.totalExpensesMinor) * 100)
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        label="Total Spent"
        value={formatAmount(summary.totalExpensesMinor)}
        icon={<DollarSign className="h-4 w-4" />}
      />
      <StatCard
        label="Average Expense"
        value={formatAmount(summary.averageExpenseMinor)}
        icon={<Wallet className="h-4 w-4" />}
      />
      <StatCard
        label="Top Category"
        value={summary.topCategory ? summary.topCategory.charAt(0).toUpperCase() + summary.topCategory.slice(1) : "None"}
        icon={<Star className="h-4 w-4" />}
      />
      <StatCard
        label="Recurring Ratio"
        value={`${recurringPercent}%`}
        icon={<CalendarDays className="h-4 w-4" />}
      />
    </div>
  );
};
