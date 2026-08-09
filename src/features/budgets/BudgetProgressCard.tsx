import React from "react";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { AlertTriangle, Pause, Play, Trash2 } from "lucide-react";
import type { BudgetProgress, BudgetDocument } from "@fairtab/domain";

interface BudgetProgressCardProps {
  progress: BudgetProgress;
  budget: BudgetDocument;
  formatAmount: (minor: number) => string;
  onToggleStatus: (budget: BudgetDocument) => void;
  onDelete: (budget: BudgetDocument) => void;
  isOwnerOrAdmin: boolean;
}

export const BudgetProgressCard: React.FC<BudgetProgressCardProps> = ({
  progress,
  budget,
  formatAmount,
  onToggleStatus,
  onDelete,
  isOwnerOrAdmin,
}) => {
  const percent = progress.percentageBps / 100;
  const isOver = progress.isOverBudget;
  const isPaused = budget.status === "paused";

  // Progress bar coloring
  let progressColor = "bg-accent-indigo";
  if (isOver) {
    progressColor = "bg-danger animate-pulse";
  } else if (percent > 80) {
    progressColor = "bg-warning";
  }

  const getScopeBadge = () => {
    if (budget.scope === "overall") {
      return (
        <span className="text-[10px] text-accent-indigo bg-accent-indigo/15 px-2 py-0.5 rounded font-semibold uppercase tracking-wider border border-accent-indigo/10">
          Overall
        </span>
      );
    }
    if (budget.scope === "category" && budget.category) {
      const catName = budget.category.charAt(0).toUpperCase() + budget.category.slice(1);
      return (
        <span className="text-[10px] text-accent-cyan bg-accent-cyan/15 px-2 py-0.5 rounded font-semibold uppercase tracking-wider border border-accent-cyan/10">
          Category: {catName}
        </span>
      );
    }
    return (
      <span className="text-[10px] text-accent-violet bg-accent-violet/15 px-2 py-0.5 rounded font-semibold uppercase tracking-wider border border-accent-violet/10">
        Member Budget
      </span>
    );
  };

  return (
    <GlassPanel variant="standard" className={`flex flex-col gap-4 relative overflow-hidden ${isPaused ? "opacity-60" : ""}`}>
      {/* Scope Badge and Status Toggles */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getScopeBadge()}
          {isPaused && (
            <span className="text-[10px] text-text-muted bg-white/5 px-2 py-0.5 rounded font-semibold uppercase tracking-wider border border-white/5">
              Paused
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {isOwnerOrAdmin && (
            <>
              <button
                onClick={() => onToggleStatus(budget)}
                className="p-1 rounded text-text-secondary hover:bg-white/5 hover:text-text-primary transition-colors cursor-pointer"
                title={isPaused ? "Resume Budget" : "Pause Budget"}
              >
                {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => onDelete(budget)}
                className="p-1 rounded text-text-secondary hover:bg-white/5 hover:text-danger transition-colors cursor-pointer"
                title="Delete Budget"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Budget Name & Info */}
      <div>
        <h4 className="text-sm font-bold text-text-primary truncate">{budget.name}</h4>
        <p className="text-[10px] text-text-muted mt-0.5 uppercase tracking-wider font-semibold">
          {budget.period} period Starting {budget.startDate} ({budget.timeZone})
        </p>
      </div>

      {/* Numerical Stats */}
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <span className="text-text-muted font-medium">Spent / Limit</span>
          <p className="text-sm font-bold text-text-primary mt-0.5">
            {formatAmount(progress.spentMinor)} / <span className="text-text-secondary">{formatAmount(progress.limitMinor)}</span>
          </p>
        </div>
        <div className="text-right">
          <span className="text-text-muted font-medium">{isOver ? "Overspending" : "Remaining"}</span>
          <p className={`text-sm font-bold mt-0.5 ${isOver ? "text-danger" : "text-success"}`}>
            {formatAmount(Math.abs(progress.remainingMinor))}
          </p>
        </div>
      </div>

      {/* CSS-Only Progress Bar */}
      <div className="flex flex-col gap-1.5">
        <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
          <div
            style={{ width: `${Math.min(percent, 100)}%` }}
            className={`h-full ${progressColor}`}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] font-bold text-text-muted">
          <span>{percent.toFixed(0)}% Used</span>
          {isOver && (
            <span className="text-danger flex items-center gap-1 uppercase tracking-wide">
              <AlertTriangle className="h-3 w-3 animate-bounce" />
              Budget Overrun
            </span>
          )}
        </div>
      </div>
    </GlassPanel>
  );
};
