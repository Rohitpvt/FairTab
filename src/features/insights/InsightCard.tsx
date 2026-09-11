import React from "react";
import { AlertCircle, AlertTriangle, Info, Sparkles, HelpCircle } from "lucide-react";
import type { SmartInsight } from "@fairtab/domain";

interface InsightCardProps {
  insight: SmartInsight;
  onExplain: (insight: SmartInsight) => void;
}

export const InsightCard: React.FC<InsightCardProps> = ({ insight, onExplain }) => {
  const getSeverityStyles = () => {
    switch (insight.severity) {
      case "critical":
        return {
          bg: "bg-red-500/10 border-red-500/25 dark:bg-red-500/10 dark:border-red-500/20",
          text: "text-red-700 dark:text-red-400",
          icon: <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />,
          badge: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
        };
      case "warning":
        return {
          bg: "bg-amber-500/10 border-amber-500/30 dark:bg-amber-500/10 dark:border-amber-500/20",
          text: "text-amber-800 dark:text-amber-400",
          icon: <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />,
          badge: "bg-amber-500/15 text-amber-800 dark:text-amber-400 border-amber-500/30",
        };
      case "info":
      default:
        return {
          bg: "bg-indigo-500/10 border-indigo-500/25 dark:bg-indigo-500/10 dark:border-indigo-500/20",
          text: "text-indigo-700 dark:text-indigo-400",
          icon: <Info className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0" />,
          badge: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30",
        };
    }
  };

  const styles = getSeverityStyles();

  return (
    <div className={`flex flex-col justify-between gap-3 p-4 sm:p-5 rounded-2xl border backdrop-blur-md transition-all hover:shadow-md ${styles.bg}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {styles.icon}
          <h3 className="text-xs sm:text-sm font-bold text-text-primary tracking-wide">
            {insight.title}
          </h3>
        </div>
        <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border tracking-widest shrink-0 ${styles.badge}`}>
          {insight.severity}
        </span>
      </div>

      <p className="text-xs text-text-secondary leading-relaxed font-normal">
        {insight.explanation}
      </p>

      <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-border-color/40 text-[10px] text-text-muted mt-auto w-full">
        <span
          className="flex items-center gap-1 min-w-0 flex-1 font-mono text-[10px] text-text-muted overflow-hidden"
          title={`Code: ${insight.reasonCode}`}
        >
          <Sparkles className="h-3 w-3 text-accent-indigo shrink-0" />
          <span className="truncate">Code: {insight.reasonCode}</span>
        </span>
        <button
          type="button"
          onClick={() => onExplain(insight)}
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent-indigo/10 hover:bg-accent-indigo/20 text-accent-indigo dark:text-accent-cyan font-semibold text-[11px] whitespace-nowrap transition-all cursor-pointer active:scale-95 border border-accent-indigo/20 focus:outline-none"
        >
          <HelpCircle className="h-3.5 w-3.5 shrink-0" />
          <span>Explain Metrics</span>
        </button>
      </div>
    </div>
  );
};
