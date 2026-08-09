import React from "react";
import { Dialog } from "../../components/ui/Dialogs";
import type { SmartInsight } from "@fairtab/domain";
import { TrendingUp, AlertTriangle, UserCheck, Calendar, RefreshCw, Layers } from "lucide-react";

interface InsightExplanationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  insight: SmartInsight | null;
  currency: string;
}

export const InsightExplanationDialog: React.FC<InsightExplanationDialogProps> = ({
  isOpen,
  onOpenChange,
  insight,
  currency,
}) => {
  if (!insight) return null;

  const formatMinor = (minor: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(minor / 100);
  };

  const renderContent = () => {
    const vals = insight.supportingValues;

    switch (insight.type) {
      case "category_spike":
        return (
          <div className="flex flex-col gap-4 text-xs">
            <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg">
              <TrendingUp className="h-5 w-5 text-accent-indigo" />
              <div>
                <p className="font-semibold text-text-primary">Spike Detection Details</p>
                <p className="text-text-muted">Comparing current month-to-date against 3-month baseline</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 p-3 rounded-lg border border-white/5 text-center">
                <span className="text-[10px] text-text-muted uppercase tracking-wide">Current Month Spend</span>
                <p className="text-sm font-bold text-text-primary mt-1">
                  {formatMinor(Number(vals.currentMtdSpend || 0))}
                </p>
              </div>
              <div className="bg-white/5 p-3 rounded-lg border border-white/5 text-center">
                <span className="text-[10px] text-text-muted uppercase tracking-wide">Historical Average</span>
                <p className="text-sm font-bold text-text-secondary mt-1">
                  {formatMinor(Number(vals.baselineMtdSpend || 0))}
                </p>
              </div>
            </div>

            <div className="bg-white/5 p-3.5 rounded-lg border border-white/5 flex flex-col gap-2">
              <p className="font-semibold text-text-primary">Calculation Formula:</p>
              <code className="bg-black/30 p-2 rounded text-[10px] text-accent-indigo font-mono block">
                Increase = (Current - Baseline) / Baseline = {String(vals.percentIncrease)}%
              </code>
              <p className="text-[10px] text-text-muted mt-1 leading-relaxed">
                A category spike is triggered when spending this month exceeds the 3-month historical average by at least 150% (1.5x) and increases by an absolute value of at least {formatMinor(1500)}.
              </p>
            </div>
          </div>
        );

      case "mom_anomaly":
        return (
          <div className="flex flex-col gap-4 text-xs">
            <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              <div>
                <p className="font-semibold text-text-primary">Group Anomaly Details</p>
                <p className="text-text-muted">Comparing total group month-to-date against historical levels</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 p-3 rounded-lg border border-white/5 text-center">
                <span className="text-[10px] text-text-muted uppercase tracking-wide">Current Month Total</span>
                <p className="text-sm font-bold text-text-primary mt-1">
                  {formatMinor(Number(vals.currentMtdSpend || 0))}
                </p>
              </div>
              <div className="bg-white/5 p-3 rounded-lg border border-white/5 text-center">
                <span className="text-[10px] text-text-muted uppercase tracking-wide">Historical Average</span>
                <p className="text-sm font-bold text-text-secondary mt-1">
                  {formatMinor(Number(vals.baselineMtdSpend || 0))}
                </p>
              </div>
            </div>

            <div className="bg-white/5 p-3.5 rounded-lg border border-white/5 flex flex-col gap-2">
              <p className="font-semibold text-text-primary">Calculation Formula:</p>
              <code className="bg-black/30 p-2 rounded text-[10px] text-amber-400 font-mono block">
                MoM Increase = (Current - Baseline) / Baseline = {String(vals.percentIncrease)}%
              </code>
              <p className="text-[10px] text-text-muted mt-1 leading-relaxed">
                An overall spending anomaly is triggered when total group spending this month exceeds the 3-month baseline by at least 130% (1.3x) and has increased by an absolute value of at least {formatMinor(5000)}.
              </p>
            </div>
          </div>
        );

      case "budget_risk":
        return (
          <div className="flex flex-col gap-4 text-xs">
            <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg">
              <Layers className="h-5 w-5 text-accent-indigo" />
              <div>
                <p className="font-semibold text-text-primary">Budget Risk Details</p>
                <p className="text-text-muted">Comparing percentage of budget spent vs time elapsed</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 p-3 rounded-lg border border-white/5 text-center">
                <span className="text-[10px] text-text-muted uppercase tracking-wide">Budget Limit</span>
                <p className="text-sm font-bold text-text-primary mt-1">
                  {formatMinor(Number(vals.limitMinor || 0))}
                </p>
              </div>
              <div className="bg-white/5 p-3 rounded-lg border border-white/5 text-center">
                <span className="text-[10px] text-text-muted uppercase tracking-wide">Amount Spent</span>
                <p className="text-sm font-bold text-text-secondary mt-1">
                  {formatMinor(Number(vals.spentMinor || 0))}
                </p>
              </div>
            </div>

            <div className="bg-white/5 p-3.5 rounded-lg border border-white/5 flex flex-col gap-3">
              <p className="font-semibold text-text-primary">Risk Indicators:</p>
              <div className="flex justify-between items-center text-[11px] text-text-secondary">
                <span>Budget Spent:</span>
                <span className="font-bold text-text-primary">{String(vals.spentPercent ?? 100)}%</span>
              </div>
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-accent-indigo h-full rounded-full"
                  style={{ width: `${Math.min(100, Number(vals.spentPercent ?? 100))}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-[11px] text-text-secondary">
                <span>Time Elapsed:</span>
                <span className="font-bold text-text-primary">{String(vals.elapsedPercent ?? 100)}%</span>
              </div>
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-accent-indigo h-full rounded-full opacity-60"
                  style={{ width: `${Math.min(100, Number(vals.elapsedPercent ?? 100))}%` }}
                />
              </div>

              <p className="text-[10px] text-text-muted mt-1 leading-relaxed">
                Risk alerts are triggered when budget spending exceeds elapsed time boundaries (spent &gt;= 85% when elapsed time is less than 80%) or when the budget is fully overspent (&gt;= 100%).
              </p>
            </div>
          </div>
        );

      case "contribution_imbalance":
        return (
          <div className="flex flex-col gap-4 text-xs">
            <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg">
              <UserCheck className="h-5 w-5 text-accent-indigo" />
              <div>
                <p className="font-semibold text-text-primary">Contribution Balance Details</p>
                <p className="text-text-muted">Tracking individual member share deviations</p>
              </div>
            </div>

            <div className="bg-white/5 p-3.5 rounded-lg border border-white/5 flex flex-col gap-2">
              <span className="text-[10px] text-text-muted uppercase tracking-wide">Net Member Position</span>
              <p className="text-lg font-bold text-text-primary">
                {formatMinor(Number(vals.netBalanceMinor || 0))}
              </p>
              <p className="text-[10px] text-text-muted mt-1 leading-relaxed">
                Net balance combines total paid expenses and settlements minus owed expense splits and received settlements. Imbalance flags trigger when outstanding positions deviate by $\ge {formatMinor(5000)}$ to prompt a friendly settlement.
              </p>
            </div>
          </div>
        );

      case "recurring_change":
        return (
          <div className="flex flex-col gap-4 text-xs">
            <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg">
              <RefreshCw className="h-5 w-5 text-accent-indigo" />
              <div>
                <p className="font-semibold text-text-primary">Recurring Deviation Details</p>
                <p className="text-text-muted">Comparing approved occurrence cost vs template baseline</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 p-3 rounded-lg border border-white/5 text-center">
                <span className="text-[10px] text-text-muted uppercase tracking-wide">Occurrence Cost</span>
                <p className="text-sm font-bold text-text-primary mt-1">
                  {formatMinor(Number(vals.actualAmountMinor || 0))}
                </p>
              </div>
              <div className="bg-white/5 p-3 rounded-lg border border-white/5 text-center">
                <span className="text-[10px] text-text-muted uppercase tracking-wide">Template Baseline</span>
                <p className="text-sm font-bold text-text-secondary mt-1">
                  {formatMinor(Number(vals.baselineAmountMinor || 0))}
                </p>
              </div>
            </div>

            <div className="bg-white/5 p-3.5 rounded-lg border border-white/5 flex flex-col gap-2">
              <span className="text-[10px] text-text-muted uppercase tracking-wide">Deviation Ratio</span>
              <p className="text-lg font-bold text-text-primary">
                +{String(vals.deviationPercent)}%
              </p>
              <p className="text-[10px] text-text-muted mt-1 leading-relaxed">
                Triggered when an approved recurring occurrence cost deviates from its parent template baseline amount by more than 10%.
              </p>
            </div>
          </div>
        );

      case "duplicate_expense":
        return (
          <div className="flex flex-col gap-4 text-xs">
            <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div>
                <p className="font-semibold text-red-400">Possible Duplicate Expense Detected</p>
                <p className="text-text-secondary text-[10px] mt-0.5">Please review these transactions manually.</p>
              </div>
            </div>

            <div className="bg-white/5 p-3 rounded-lg border border-white/5 flex flex-col gap-2">
              <p className="font-semibold text-text-primary">Comparison Metrics:</p>
              <ul className="list-disc list-inside text-text-muted flex flex-col gap-1 text-[11px]">
                <li>Amount: {formatMinor(Number(vals.amountMinor || 0))} ({String(vals.currency)})</li>
                <li>Time Difference: Less than 24 hours</li>
                <li>Title 1: <span className="text-text-primary">"{String(vals.title1)}"</span></li>
                <li>Title 2: <span className="text-text-primary">"{String(vals.title2)}"</span></li>
              </ul>
            </div>

            <div className="bg-white/5 p-3 rounded-lg border border-white/5 text-[10px] text-text-muted italic leading-relaxed">
              * Important: FairTab will never automatically delete, merge, void, or edit ledger entries. You must manually verify if these represent separate valid charges or a double-entry error, then void the duplicate if necessary.
            </div>
          </div>
        );

      case "spending_trend":
      default:
        return (
          <div className="flex flex-col gap-4 text-xs">
            <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg">
              <Calendar className="h-5 w-5 text-accent-indigo" />
              <div>
                <p className="font-semibold text-text-primary">Spending Trend Details</p>
                <p className="text-text-muted">Calculated from average MoM spending growth trend rate</p>
              </div>
            </div>

            <div className="bg-white/5 p-3.5 rounded-lg border border-white/5 flex flex-col gap-2">
              <span className="text-[10px] text-text-muted uppercase tracking-wide">Average Trend Change</span>
              <p className="text-lg font-bold text-text-primary">
                {Number(vals.averageMomChangePercent || 0) >= 0 ? "+" : ""}
                {String(vals.averageMomChangePercent)}%
              </p>
              <p className="text-[10px] text-text-muted mt-1 leading-relaxed">
                Calculated by computing the average percentage growth rate across the past 3 consecutive months.
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={insight.title}
      description={`Technical details and formula baseline for insight ${insight.id}`}
    >
      <div className="py-4">
        {renderContent()}
      </div>
    </Dialog>
  );
};
