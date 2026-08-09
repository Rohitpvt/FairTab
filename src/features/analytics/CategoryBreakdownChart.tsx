import React from "react";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { PieChart } from "lucide-react";
import type { CategoryBreakdown } from "@fairtab/domain";

interface CategoryBreakdownChartProps {
  breakdown: CategoryBreakdown[];
  formatAmount: (minor: number) => string;
}

const CATEGORY_COLORS: Record<string, string> = {
  food: "bg-accent-indigo",
  transport: "bg-accent-violet",
  shopping: "bg-accent-cyan",
  housing: "bg-success",
  utilities: "bg-warning",
  entertainment: "bg-danger",
  health: "bg-emerald-500",
  travel: "bg-pink-500",
  education: "bg-teal-500",
  other: "bg-slate-500",
};

export const CategoryBreakdownChart: React.FC<CategoryBreakdownChartProps> = ({
  breakdown,
  formatAmount,
}) => {
  const totalSpentMinor = breakdown.reduce((sum, item) => sum + item.totalMinor, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <PieChart className="h-5 w-5 text-accent-cyan" />
        <h3 className="text-base font-bold text-text-primary uppercase tracking-wider">
          Category Distribution
        </h3>
      </div>

      <GlassPanel variant="standard" className="flex flex-col gap-4">
        <div>
          <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">Total Category Spent</p>
          <p className="text-2xl font-extrabold text-text-primary financial-number mt-0.5">
            {formatAmount(totalSpentMinor)}
          </p>
        </div>

        {/* Accessible stacked progress bar visual */}
        <div className="w-full h-3 rounded-full bg-white/5 overflow-hidden flex" aria-label="Visual category breakdown bar">
          {breakdown.map((cat, idx) => {
            const percent = cat.percentageBps / 100;
            const colorClass = CATEGORY_COLORS[cat.category] || "bg-slate-500";
            return (
              <div
                key={idx}
                style={{ width: `${percent}%` }}
                className={`h-full ${colorClass}`}
                title={`${cat.category}: ${percent.toFixed(1)}%`}
              />
            );
          })}
          {breakdown.length === 0 && (
            <div className="w-full h-full bg-white/5" title="No data available" />
          )}
        </div>

        {/* List of categories with statistics */}
        <div className="flex flex-col gap-3 mt-2" role="list">
          {breakdown.map((cat, idx) => {
            const percent = (cat.percentageBps / 100).toFixed(1);
            const colorClass = CATEGORY_COLORS[cat.category] || "bg-slate-500";
            const categoryName = cat.category.charAt(0).toUpperCase() + cat.category.slice(1);
            return (
              <div key={idx} role="listitem" className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`h-2.5 w-2.5 rounded-full ${colorClass} shrink-0`} />
                  <span className="text-text-secondary truncate">{categoryName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-text-muted font-medium">{percent}%</span>
                  <span className="text-text-muted">({cat.count} {cat.count === 1 ? "bill" : "bills"})</span>
                  <span className="font-bold text-text-primary financial-number">{formatAmount(cat.totalMinor)}</span>
                </div>
              </div>
            );
          })}
          {breakdown.length === 0 && (
            <div className="text-xs text-text-muted text-center py-4">No categories recorded yet.</div>
          )}
        </div>
      </GlassPanel>
    </div>
  );
};
