import React from "react";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { CalendarRange, TrendingUp, TrendingDown } from "lucide-react";
import type { MonthlyComparison } from "@fairtab/domain";

interface MonthlyComparisonCardProps {
  trend: MonthlyComparison[];
  formatAmount: (minor: number) => string;
}

export const MonthlyComparisonCard: React.FC<MonthlyComparisonCardProps> = ({
  trend,
  formatAmount,
}) => {
  // We need at least two months to make a comparison
  const hasComparison = trend.length >= 2;
  const currentMonthData = hasComparison ? trend[trend.length - 1] : null;
  const prevMonthData = hasComparison ? trend[trend.length - 2] : null;

  let deltaPercent = 0;
  let isDecrease = false;

  if (currentMonthData && prevMonthData && prevMonthData.totalMinor > 0) {
    const diff = currentMonthData.totalMinor - prevMonthData.totalMinor;
    deltaPercent = Math.round((diff / prevMonthData.totalMinor) * 100);
    isDecrease = diff < 0;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <CalendarRange className="h-5 w-5 text-accent-indigo" />
        <h3 className="text-base font-bold text-text-primary uppercase tracking-wider">
          Month-over-Month Comparison
        </h3>
      </div>

      <GlassPanel variant="standard" className="flex flex-col gap-4 justify-between h-full">
        {hasComparison && currentMonthData && prevMonthData ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-text-muted font-bold tracking-wider uppercase">Current Month ({currentMonthData.month})</p>
                <p className="text-xl font-extrabold text-text-primary financial-number mt-0.5">
                  {formatAmount(currentMonthData.totalMinor)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-text-muted font-bold tracking-wider uppercase">Previous Month ({prevMonthData.month})</p>
                <p className="text-lg font-bold text-text-secondary financial-number mt-0.5">
                  {formatAmount(prevMonthData.totalMinor)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-white/5">
              {isDecrease ? (
                <span className="text-xs text-success bg-success/15 px-2.5 py-1 rounded font-semibold flex items-center gap-1">
                  <TrendingDown className="h-3 w-3" />
                  {Math.abs(deltaPercent)}% decrease
                </span>
              ) : (
                <span className="text-xs text-danger bg-danger/15 px-2.5 py-1 rounded font-semibold flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {deltaPercent}% increase
                </span>
              )}
              <span className="text-xs text-text-muted">vs previous period</span>
            </div>

            <div className="text-xs text-text-secondary leading-relaxed bg-white/5 p-2.5 rounded-lg border border-white/5 mt-1">
              Your group spent {formatAmount(Math.abs(currentMonthData.totalMinor - prevMonthData.totalMinor))}{" "}
              {isDecrease ? "less" : "more"} this month, with a total of {currentMonthData.count} transactions recorded.
            </div>
          </div>
        ) : (
          <div className="text-xs text-text-muted text-center py-8">
            Requires at least two months of expense data to compile a comparison.
          </div>
        )}
      </GlassPanel>
    </div>
  );
};
