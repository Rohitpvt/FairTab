import React from "react";
import {
  DollarSign,
  Coffee,
  ShoppingBag,
  Car,
  Home,
  AlertTriangle,
  RefreshCw,
  Clock,
  CheckCircle,
} from "lucide-react";
import { formatCurrency } from "../../utils/format";

export interface ExpenseRowProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  amountMinor: number;
  currency?: string;
  date: string;
  category: string;
  payerName: string;
  syncStatus?: "synced" | "queued" | "syncing" | "failed" | "conflict";
  groupName?: string;
  splitSummary?: string;
  onResolveConflict?: () => void;
}

export const ExpenseRow: React.FC<ExpenseRowProps> = ({
  title,
  amountMinor,
  currency = "INR",
  date,
  category,
  payerName,
  syncStatus = "synced",
  groupName,
  splitSummary,
  onResolveConflict,
  className = "",
  ...props
}) => {
  const getCategoryIcon = () => {
    const cat = category.toLowerCase();
    if (cat.includes("grocer") || cat.includes("food")) {
      return <ShoppingBag className="h-4 w-4" />;
    }
    if (cat.includes("cafe") || cat.includes("coffee") || cat.includes("drink")) {
      return <Coffee className="h-4 w-4" />;
    }
    if (cat.includes("transport") || cat.includes("fuel") || cat.includes("toll") || cat.includes("cab")) {
      return <Car className="h-4 w-4" />;
    }
    if (cat.includes("rent") || cat.includes("bill") || cat.includes("utilit")) {
      return <Home className="h-4 w-4" />;
    }
    return <DollarSign className="h-4 w-4" />;
  };

  const getSyncBadge = () => {
    switch (syncStatus) {
      case "queued":
        return (
          <div className="flex items-center gap-1 text-[10px] font-semibold text-warning" aria-label="Queued offline">
            <Clock className="h-3 w-3 animate-pulse" />
            <span>Queued</span>
          </div>
        );
      case "syncing":
        return (
          <div className="flex items-center gap-1 text-[10px] font-semibold text-accent-cyan" aria-label="Syncing">
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span>Syncing</span>
          </div>
        );
      case "failed":
        return (
          <div className="flex items-center gap-1 text-[10px] font-semibold text-danger" aria-label="Sync failed">
            <AlertTriangle className="h-3 w-3" />
            <span>Failed</span>
          </div>
        );
      case "conflict":
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onResolveConflict?.();
            }}
            className="flex items-center gap-1 text-[10px] font-bold text-warning hover:underline bg-warning/10 border border-warning/20 px-1.5 py-0.5 rounded cursor-pointer"
            aria-label="Version conflict. Click to resolve."
          >
            <AlertTriangle className="h-3 w-3" />
            <span>Resolve Conflict</span>
          </button>
        );
      case "synced":
      default:
        return (
          <div className="flex items-center gap-1 text-[10px] font-medium text-text-muted" aria-label="Synced with cloud">
            <CheckCircle className="h-3 w-3 text-success/70" />
            <span>Synced</span>
          </div>
        );
    }
  };

  return (
    <div
      className={`flex items-center justify-between p-4 glass-subtle rounded-xl border border-white/5 hover:border-white/10 transition-colors ${className}`}
      {...props}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="p-2.5 rounded-lg bg-surface-elevated text-text-secondary">
          {getCategoryIcon()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-text-primary truncate">{title}</h4>
            {groupName && (
              <span className="text-[10px] text-text-muted truncate px-1.5 py-0.5 rounded bg-white/5">
                {groupName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-text-muted">
            <span>{payerName} paid</span>
            {splitSummary && <span className="opacity-80">• {splitSummary}</span>}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1.5 ml-4 flex-shrink-0">
        <span className="text-sm font-bold text-text-primary financial-number">
          {formatCurrency(amountMinor, currency)}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-muted">{date}</span>
          {getSyncBadge()}
        </div>
      </div>
    </div>
  );
};
