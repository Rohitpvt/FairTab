/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useMemo } from "react";
import { PageContainer } from "../../components/layout/PageContainer";
import { groupService } from "../../infrastructure/firebase/groupService";
import { expenseService } from "../../infrastructure/firebase/expenseService";
import { settlementService } from "../../infrastructure/firebase/settlementService";
import { recurringService } from "../../infrastructure/firebase/recurringService";
import type { GroupDocument } from "../groups/groupSchema";
import type { GroupMemberDocument } from "../groups/memberSchema";
import type { ExpenseDocument, SettlementDocument, RecurringTemplateDocument } from "@fairtab/domain";
import {
  computeCategoryBreakdown,
  computeMemberContributions,
  computeMonthlyComparison,
  computeSpendingSummary,
} from "@fairtab/domain";
import { SpendingSummaryCards } from "./SpendingSummaryCards";
import { CategoryBreakdownChart } from "./CategoryBreakdownChart";
import { SpendingTrendChart } from "./SpendingTrendChart";
import { MemberContributionPanel } from "./MemberContributionPanel";
import { MonthlyComparisonCard } from "./MonthlyComparisonCard";
import { ExportAnalyticsDialog } from "./ExportAnalyticsDialog";
import { Button } from "../../components/ui/Button";
import { Download, AlertCircle } from "lucide-react";

export const AnalyticsPage: React.FC = () => {
  const [activeGroups, setActiveGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [group, setGroup] = useState<GroupDocument | null>(null);
  const [members, setMembers] = useState<GroupMemberDocument[]>([]);
  const [expenses, setExpenses] = useState<ExpenseDocument[]>([]);
  const [settlements, setSettlements] = useState<SettlementDocument[]>([]);
  const [templates, setTemplates] = useState<RecurringTemplateDocument[]>([]);

  // Telemetry caching tags
  const [isOfflineCached, setIsOfflineCached] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // 1. Fetch active groups
  useEffect(() => {
    const unsub = groupService.watchUserGroups((groups) => {
      const active = groups.filter((g) => g.status === "active");
      setActiveGroups(active);
      if (active.length > 0 && !selectedGroupId) {
        setSelectedGroupId(active[0].groupId);
      }
    });
    return () => unsub();
  }, []);

  // 2. Fetch Group Subcollections on group change
  useEffect(() => {
    if (!selectedGroupId) {
      setTimeout(() => {
        setIsLoading(false);
      }, 0);
      return;
    }

    setTimeout(() => {
      setIsLoading(true);
    }, 0);

    const unsubGroup = groupService.watchGroup(selectedGroupId, (g) => {
      setGroup(g);
    });

    const unsubMembers = groupService.watchMembers(selectedGroupId, (m) => {
      setMembers(m);
    });

    const unsubExpenses = expenseService.watchExpenses(selectedGroupId, (exp, fromCache) => {
      setExpenses(exp);
      setIsOfflineCached(fromCache);
      setIsLoading(false);
    });

    const unsubSettlements = settlementService.watchSettlements(selectedGroupId, (settle) => {
      setSettlements(settle);
    });

    const unsubTemplates = recurringService.watchTemplates(selectedGroupId, (temp) => {
      setTemplates(temp);
    });

    return () => {
      unsubGroup();
      unsubMembers();
      unsubExpenses();
      unsubSettlements();
      unsubTemplates();
    };
  }, [selectedGroupId]);

  // Derived calculations
  const groupCurrency = useMemo(() => {
    return group ? group.baseCurrency : "USD";
  }, [group]);

  const activeMembers = useMemo(() => {
    return members.filter((m) => m.status === "active");
  }, [members]);

  const recurringExpenseIds = useMemo(() => {
    // Map template target parameters if match
    return new Set(templates.map((t) => t.id));
  }, [templates]);

  const categoryBreakdown = useMemo(() => {
    return computeCategoryBreakdown(expenses);
  }, [expenses]);

  const memberContributions = useMemo(() => {
    const memberItems = activeMembers.map((m) => ({
      memberId: m.id,
      displayName: m.displayName,
    }));
    return computeMemberContributions(expenses, memberItems);
  }, [expenses, activeMembers]);

  const monthlyComparison = useMemo(() => {
    return computeMonthlyComparison(expenses, 6);
  }, [expenses]);

  const spendingSummary = useMemo(() => {
    return computeSpendingSummary(expenses, settlements, recurringExpenseIds);
  }, [expenses, settlements, recurringExpenseIds]);

  const formatAmount = (minor: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: groupCurrency,
      minimumFractionDigits: 2,
    }).format(minor / 100);
  };

  const handleGroupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedGroupId(e.target.value);
  };

  return (
    <PageContainer
      title="Analytics & Insights"
      description="Real-time financial summaries and breakdown analysis from your shared group ledger."
    >
      <div className="flex flex-col gap-6">
        {/* Top filter bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/5 border border-white/10 p-4 rounded-xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <label htmlFor="group-select" className="text-xs font-bold text-text-secondary uppercase tracking-wider">
              Select Group:
            </label>
            <select
              id="group-select"
              value={selectedGroupId}
              onChange={handleGroupChange}
              className="bg-background-dark border border-white/15 text-text-primary text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-accent-indigo"
            >
              {activeGroups.map((g) => (
                <option key={g.groupId} value={g.groupId}>
                  {g.groupName}
                </option>
              ))}
              {activeGroups.length === 0 && <option value="">No Active Groups</option>}
            </select>
          </div>

          <div className="flex items-center gap-3">
            {isOfflineCached && (
              <span className="text-xs text-warning bg-warning/15 px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 border border-warning/10">
                <AlertCircle className="h-3.5 w-3.5 animate-pulse" />
                Offline Cache / Stale Data
              </span>
            )}
            <Button
              variant="secondary"
              disabled={isLoading || activeGroups.length === 0}
              onClick={() => setIsExportOpen(true)}
              className="flex items-center gap-2 text-xs"
            >
              <Download className="h-4 w-4" />
              Export Ledger
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="h-8 w-8 rounded-full border-2 border-accent-indigo border-t-transparent animate-spin" />
            <span className="text-xs text-text-muted">Compiling transactions...</span>
          </div>
        ) : activeGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border border-white/5 rounded-xl bg-white/5 text-center">
            <p className="text-sm font-semibold text-text-secondary">No groups configured.</p>
            <p className="text-xs text-text-muted mt-1">Create or join a group to explore spending trends.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* KPI Cards */}
            <SpendingSummaryCards summary={spendingSummary} currency={groupCurrency} formatAmount={formatAmount} />

            {/* Grid display charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CategoryBreakdownChart breakdown={categoryBreakdown} formatAmount={formatAmount} />
              <SpendingTrendChart trend={monthlyComparison} formatAmount={formatAmount} />
              <MemberContributionPanel contributions={memberContributions} formatAmount={formatAmount} />
              <MonthlyComparisonCard trend={monthlyComparison} formatAmount={formatAmount} />
            </div>
          </div>
        )}
      </div>

      <ExportAnalyticsDialog
        isOpen={isExportOpen}
        onOpenChange={setIsExportOpen}
        expenses={expenses}
        settlements={settlements}
        members={members}
      />
    </PageContainer>
  );
};

export default AnalyticsPage;
