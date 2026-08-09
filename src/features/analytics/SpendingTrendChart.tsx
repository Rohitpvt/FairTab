import React from "react";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { BarChart } from "lucide-react";
import type { MonthlyComparison } from "@fairtab/domain";

interface SpendingTrendChartProps {
  trend: MonthlyComparison[];
  formatAmount: (minor: number) => string;
}

export const SpendingTrendChart: React.FC<SpendingTrendChartProps> = ({
  trend,
  formatAmount,
}) => {
  const maxVal = Math.max(...trend.map((t) => t.totalMinor), 0);

  const getMonthName = (monthStr: string) => {
    // monthStr: YYYY-MM
    const parts = monthStr.split("-");
    if (parts.length !== 2) return monthStr;
    const date = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, 1));
    return date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <BarChart className="h-5 w-5 text-accent-indigo" />
        <h3 className="text-base font-bold text-text-primary uppercase tracking-wider">
          Monthly Trend
        </h3>
      </div>

      <GlassPanel variant="standard" className="flex flex-col gap-4 h-full justify-between">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>Active Spending Timeline</span>
          <span>Values in base currency</span>
        </div>

        {/* Bar chart grid visualization using standard HTML/CSS */}
        <div className="flex items-end justify-between h-[150px] pt-4 px-2" aria-label="Monthly trend chart">
          {trend.map((bar, idx) => {
            const pct = maxVal > 0 ? (bar.totalMinor / maxVal) * 100 : 0;
            const barHeight = `${Math.max(pct, 5)}%`; // minimum 5% height to be visible
            const monthLabel = getMonthName(bar.month);
            return (
              <div key={idx} className="flex flex-col items-center gap-2 w-12 group">
                <div className="w-full flex justify-center text-[10px] text-text-muted font-bold financial-number mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {formatAmount(bar.totalMinor)}
                </div>
                <div
                  style={{ height: barHeight }}
                  className="w-full bg-gradient-to-t from-accent-indigo to-accent-cyan rounded-t transition-all duration-300 hover:brightness-110 cursor-pointer"
                  title={`${bar.month}: ${formatAmount(bar.totalMinor)}`}
                />
                <span className="text-[10px] text-text-muted mt-1 font-semibold">{monthLabel}</span>
              </div>
            );
          })}
          {trend.length === 0 && (
            <div className="w-full h-full flex items-center justify-center text-xs text-text-muted">
              No historical data available.
            </div>
          )}
        </div>

        {/* Screen-reader accessible data description table */}
        <table className="sr-only">
          <caption>Monthly spending trend table</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Amount Spent</th>
            </tr>
          </thead>
          <tbody>
            {trend.map((bar, idx) => (
              <tr key={idx}>
                <td>{bar.month}</td>
                <td>{formatAmount(bar.totalMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassPanel>
    </div>
  );
};
