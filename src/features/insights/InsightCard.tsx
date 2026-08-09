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
          bg: "bg-red-500/10 border-red-500/20",
          text: "text-red-400",
          icon: <AlertCircle className="h-5 w-5 text-red-400" />,
          badge: "bg-red-500/15 text-red-400 border-red-500/30",
        };
      case "warning":
        return {
          bg: "bg-amber-500/10 border-amber-500/20",
          text: "text-amber-400",
          icon: <AlertTriangle className="h-5 w-5 text-amber-400" />,
          badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        };
      case "info":
      default:
        return {
          bg: "bg-indigo-500/10 border-indigo-500/20",
          text: "text-indigo-400",
          icon: <Info className="h-5 w-5 text-indigo-400" />,
          badge: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
        };
    }
  };

  const styles = getSeverityStyles();

  return (
    <div className={`flex flex-col gap-3 p-4 rounded-xl border backdrop-blur-md transition-all hover:bg-white/5 ${styles.bg}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {styles.icon}
          <h3 className="text-xs font-bold text-text-primary tracking-wide">
            {insight.title}
          </h3>
        </div>
        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border tracking-widest ${styles.badge}`}>
          {insight.severity}
        </span>
      </div>

      <p className="text-[11px] text-text-secondary leading-relaxed">
        {insight.explanation}
      </p>

      <div className="flex items-center justify-between mt-1 text-[10px] text-text-muted">
        <span className="flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-accent-indigo" />
          Code: {insight.reasonCode}
        </span>
        <button
          onClick={() => onExplain(insight)}
          className="flex items-center gap-1 text-accent-indigo hover:text-accent-indigo-hover font-semibold transition-colors focus:outline-none"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          Explain Metrics
        </button>
      </div>
    </div>
  );
};
