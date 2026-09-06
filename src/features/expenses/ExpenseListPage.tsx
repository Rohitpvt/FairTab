import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { expenseService } from "../../infrastructure/firebase/expenseService";
import type { ExpenseDocument } from "@fairtab/domain";
import { formatMinorUnit } from "@fairtab/domain";
import { syncManager } from "../../infrastructure/offline/syncManager";
import { Button } from "../../components/ui/Button";
import {
  Search,
  Plus,
  RefreshCw,
  AlertTriangle,
  Clock,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Skeleton } from "../../components/ui/Skeleton";
import type { GroupMemberDocument } from "../groups/memberSchema";
import { useMemberNameResolver } from "../../hooks/useMemberNameResolver";

interface ExpenseListPageProps {
  groupId: string;
  members: GroupMemberDocument[];
  groupBaseCurrency: string;
  isArchived: boolean;
}

export const ExpenseListPage: React.FC<ExpenseListPageProps> = ({
  groupId,
  members,
  groupBaseCurrency,
  isArchived,
}) => {
  const [expenses, setExpenses] = useState<ExpenseDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Foreground outbox sync status
  const [syncStatus, setSyncStatus] = useState({
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingCount: 0,
    failedCount: 0,
  });

  useEffect(() => {
    // Listen to sync manager state
    const unsubSync = syncManager.registerListener((status) => {
      setSyncStatus(status);
    });

    // Listen to expenses subcollection
    const unsubExpenses = expenseService.watchExpenses(groupId, (data) => {
      setExpenses(data);
      setIsLoading(false);
    });

    return () => {
      unsubSync();
      unsubExpenses();
    };
  }, [groupId]);

  const { memberNameMap } = useMemberNameResolver(members);

  const getMemberName = (id: string) => memberNameMap[id] || id;

  // Filtered and sorted list (newest first)
  const filtered = expenses
    .filter((e) => {
      const matchesSearch =
        e.title.toLowerCase().includes(search.toLowerCase()) ||
        getMemberName(e.payers[0]?.memberId || "").toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === "all" || e.category === categoryFilter;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      const timeA =
        (a.incurredAt as { seconds?: number })?.seconds ??
        (a.createdAt as { seconds?: number })?.seconds ??
        0;
      const timeB =
        (b.incurredAt as { seconds?: number })?.seconds ??
        (b.createdAt as { seconds?: number })?.seconds ??
        0;

      if (timeB !== timeA) {
        return timeB - timeA;
      }

      // Secondary tie-breaker by createdAt
      const createdA = (a.createdAt as { seconds?: number })?.seconds ?? 0;
      const createdB = (b.createdAt as { seconds?: number })?.seconds ?? 0;
      return createdB - createdA;
    });

  return (
    <div className="flex flex-col gap-4 text-left">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-base font-bold text-text-primary">Ledger Transactions</h3>
          <p className="text-xs text-text-muted">Review, filter, and track group expenditures.</p>
        </div>
        {!isArchived && (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Link to={`/groups/${groupId}/receipts/new`} className="w-full sm:w-auto">
              <Button variant="ghost" className="w-full sm:w-auto flex items-center justify-center gap-1.5 border border-white/10 hover:bg-white/5">
                <Sparkles className="h-4 w-4 text-sky-400" /> Scan Receipt
              </Button>
            </Link>
            <Link to={`/groups/${groupId}/expenses/new`} className="w-full sm:w-auto">
              <Button variant="gradient" className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-1.5" /> Add Expense
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Sync Status Indicators Card */}
      {(syncStatus.pendingCount > 0 || syncStatus.failedCount > 0 || syncStatus.isSyncing) && (
        <div className="glass-subtle border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {syncStatus.isSyncing ? (
              <RefreshCw className="h-4 w-4 text-accent-cyan animate-spin" />
            ) : syncStatus.failedCount > 0 ? (
              <AlertTriangle className="h-4 w-4 text-danger animate-pulse" />
            ) : (
              <Clock className="h-4 w-4 text-warning" />
            )}
            <div className="text-xs">
              <span className="font-bold text-text-primary">Foreground outbox sync</span>
              <p className="text-text-muted mt-0.5">
                {syncStatus.isSyncing && "Processing queue... "}
                {syncStatus.pendingCount > 0 && `${syncStatus.pendingCount} pending updates. `}
                {syncStatus.failedCount > 0 && `${syncStatus.failedCount} uploads failed.`}
              </p>
            </div>
          </div>
          {syncStatus.failedCount > 0 && syncStatus.isOnline && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => syncManager.triggerSync()}
              className="text-xs flex gap-1"
            >
              <RefreshCw className="h-3 w-3" /> Retry Sync
            </Button>
          )}
        </div>
      )}

      {/* Filter and Search controls */}
      <div className="flex gap-2">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
          <input
            type="text"
            placeholder="Search by title or payer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white/[0.02] border border-white/10 rounded-lg text-xs text-text-primary focus:outline-none focus:border-accent-cyan transition-colors"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-white/[0.02] border border-white/10 rounded-lg px-2.5 py-2 text-xs text-text-secondary focus:outline-none focus:border-accent-cyan transition-colors"
        >
          <option value="all">All Categories</option>
          <option value="food">Food</option>
          <option value="transport">Transport</option>
          <option value="shopping">Shopping</option>
          <option value="housing">Housing</option>
          <option value="utilities">Utilities</option>
          <option value="entertainment">Entertainment</option>
          <option value="health">Health</option>
          <option value="travel">Travel</option>
          <option value="education">Education</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Expenses Ledger List */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-elevated border border-white/5 rounded-2xl py-12 text-center text-xs text-text-muted italic">
          No matching transactions logged in this group ledger.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((exp) => {
            const isVoided = exp.status === "voided";
            const payerName = getMemberName(exp.payers[0]?.memberId || "");
            const formattedDate = exp.incurredAt?.seconds
              ? new Date(exp.incurredAt.seconds * 1000).toLocaleDateString()
              : "Date unknown";

            return (
              <div
                key={exp.id}
                className={`glass-elevated border rounded-xl p-4 flex justify-between items-center transition-all hover:bg-white/[0.02] ${
                  isVoided
                    ? "border-danger/10 opacity-60 bg-danger/[0.01]"
                    : "border-white/5 hover:border-white/10"
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-text-primary flex items-center gap-2">
                    {exp.title}
                    {isVoided && (
                      <span className="text-[9px] bg-danger/15 border border-danger/30 px-1.5 py-0.5 rounded text-danger font-bold uppercase tracking-wider">
                        Voided
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-text-muted">
                    Paid by {payerName} • {formattedDate}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-text-primary block">
                      {formatMinorUnit(exp.amountMinor, exp.currency)}
                    </span>
                    {exp.currency !== groupBaseCurrency && (
                      <span className="text-[9px] text-text-muted block">
                        ≈ {formatMinorUnit(exp.baseAmountMinor, groupBaseCurrency)}
                      </span>
                    )}
                  </div>
                  <Link to={`/groups/${groupId}/expenses/${exp.id}`}>
                    <Button variant="ghost" size="icon" className="text-text-muted hover:text-text-primary">
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ExpenseListPage;
