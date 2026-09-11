/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useMemo } from "react";
import { PageContainer } from "../../components/layout/PageContainer";
import { groupService } from "../../infrastructure/firebase/groupService";
import { expenseService } from "../../infrastructure/firebase/expenseService";
import { settlementService } from "../../infrastructure/firebase/settlementService";
import { budgetService } from "../../infrastructure/firebase/budgetService";
import { recurringService } from "../../infrastructure/firebase/recurringService";
import { auth } from "../../infrastructure/firebase/firebase";
import { offlineDb } from "../../infrastructure/offline/db";
import type { OfflineInsight } from "../../infrastructure/offline/db";
import type { GroupDocument } from "../groups/groupSchema";
import type { GroupMemberDocument } from "../groups/memberSchema";
import type {
  ExpenseDocument,
  SettlementDocument,
  RecurringTemplateDocument,
  RecurringOccurrenceDocument,
  BudgetDocument,
  SmartInsight,
  InsightType,
  InsightSeverity,
} from "@fairtab/domain";
import {
  computeCategoryBreakdown,
  computeMemberContributions,
  computeMonthlyComparison,
  computeSpendingSummary,
  generateSmartInsights,
} from "@fairtab/domain";
import { SpendingSummaryCards } from "./SpendingSummaryCards";
import { CategoryBreakdownChart } from "./CategoryBreakdownChart";
import { SpendingTrendChart } from "./SpendingTrendChart";
import { MemberContributionPanel } from "./MemberContributionPanel";
import { MonthlyComparisonCard } from "./MonthlyComparisonCard";
import { ExportAnalyticsDialog } from "./ExportAnalyticsDialog";
import { HistoricalLedgerAndBalanceSection } from "./HistoricalLedgerAndBalanceSection";
import { InsightCard } from "../insights/InsightCard";
import { InsightExplanationDialog } from "../insights/InsightDetailDialogs";
import { Button } from "../../components/ui/Button";
import { BalanceCardSkeleton, ChartSkeleton, InsightCardSkeleton } from "../../components/ui/Skeleton";
import { Download, AlertCircle, Sparkles, BarChart2, CheckCircle2 } from "lucide-react";
import { useMemberNameResolver } from "../../hooks/useMemberNameResolver";

export const AnalyticsPage: React.FC = () => {
  const [activeGroups, setActiveGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [group, setGroup] = useState<GroupDocument | null>(null);
  const [members, setMembers] = useState<GroupMemberDocument[]>([]);
  const [expenses, setExpenses] = useState<ExpenseDocument[]>([]);
  const [settlements, setSettlements] = useState<SettlementDocument[]>([]);
  const [budgets, setBudgets] = useState<BudgetDocument[]>([]);
  const [templates, setTemplates] = useState<RecurringTemplateDocument[]>([]);
  const [approvedOccurrences, setApprovedOccurrences] = useState<RecurringOccurrenceDocument[]>([]);

  // Telemetry & caching tags
  const [isOfflineCached, setIsOfflineCached] = useState(false);
  const [offlineInsights, setOfflineInsights] = useState<SmartInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Smart Insight modal explanation state
  const [selectedInsight, setSelectedInsight] = useState<SmartInsight | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const { resolveName } = useMemberNameResolver(members);

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

    const unsubBudgets = budgetService.watchBudgets(selectedGroupId, (b, fromCache) => {
      setBudgets(b);
      if (fromCache) setIsOfflineCached(true);
    });

    const unsubTemplates = recurringService.watchTemplates(selectedGroupId, (temp) => {
      setTemplates(temp);
    });

    return () => {
      unsubGroup();
      unsubMembers();
      unsubExpenses();
      unsubSettlements();
      unsubBudgets();
      unsubTemplates();
    };
  }, [selectedGroupId]);

  // 3. Watch approved occurrences for active templates
  useEffect(() => {
    if (!selectedGroupId || templates.length === 0) {
      setApprovedOccurrences([]);
      return;
    }

    const unsubOccurrences = recurringService.watchAllApprovedOccurrences(
      selectedGroupId,
      templates,
      (occs) => {
        setApprovedOccurrences(occs);
      }
    );

    return () => unsubOccurrences();
  }, [selectedGroupId, templates]);

  // 4. Fetch offline cache for insights
  useEffect(() => {
    const loadOfflineCache = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid || !selectedGroupId) return;
      try {
        const list = await offlineDb.smartInsights
          .where("uid")
          .equals(uid)
          .and((item: OfflineInsight) => item.groupId === selectedGroupId)
          .toArray();

        const mapped = list.map((item) => ({
          id: item.id,
          type: item.type as InsightType,
          severity: item.severity as InsightSeverity,
          title: item.title,
          explanation: item.explanation,
          supportingValues: JSON.parse(item.supportingValues),
          comparisonBaseline: item.comparisonBaseline,
          generatedAt: item.generatedAt,
          reasonCode: item.reasonCode,
          metadata: item.metadata ? JSON.parse(item.metadata) : undefined,
        }));
        setOfflineInsights(mapped);
      } catch (err) {
        console.error("Failed to load offline smart insights cache:", err);
      }
    };
    loadOfflineCache();
  }, [selectedGroupId]);

  // 5. Compute Smart Insights dynamically
  const computedInsights = useMemo(() => {
    if (!selectedGroupId || !group || members.length === 0) {
      return [];
    }

    const engineMembers = members.map((m) => ({
      id: m.id,
      displayName: resolveName(m),
    }));

    return generateSmartInsights({
      groupId: selectedGroupId,
      expenses,
      settlements,
      members: engineMembers,
      budgets,
      templates,
      approvedOccurrences,
      groupBaseCurrency: group.baseCurrency,
    });
  }, [selectedGroupId, group, expenses, settlements, members, budgets, templates, approvedOccurrences, resolveName]);

  // 6. Persist insights to local cache
  useEffect(() => {
    const saveCachedInsights = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid || !selectedGroupId || computedInsights.length === 0) return;
      try {
        await offlineDb.smartInsights
          .where("uid")
          .equals(uid)
          .and((item: OfflineInsight) => item.groupId === selectedGroupId)
          .delete();

        const offlineItems = computedInsights.map((insight) => ({
          id: insight.id,
          uid,
          groupId: selectedGroupId,
          type: insight.type,
          severity: insight.severity,
          title: insight.title,
          explanation: insight.explanation,
          supportingValues: JSON.stringify(insight.supportingValues),
          comparisonBaseline: insight.comparisonBaseline,
          generatedAt: insight.generatedAt,
          reasonCode: insight.reasonCode,
          metadata: insight.metadata ? JSON.stringify(insight.metadata) : undefined,
        }));
        await offlineDb.smartInsights.bulkPut(offlineItems);
      } catch (err) {
        console.error("Failed to save insights to local IndexedDB cache:", err);
      }
    };
    saveCachedInsights();
  }, [computedInsights, selectedGroupId]);

  // Display insights fallback to offline cache if needed
  const displayInsights = useMemo(() => {
    if (computedInsights.length > 0) {
      return computedInsights;
    }
    return offlineInsights;
  }, [computedInsights, offlineInsights]);

  // Derived calculations for analytics charts & summaries
  const groupCurrency = useMemo(() => {
    return group ? group.baseCurrency : "USD";
  }, [group]);

  const activeMembers = useMemo(() => {
    return members.filter((m) => m.status === "active");
  }, [members]);

  const recurringExpenseIds = useMemo(() => {
    return new Set(templates.map((t) => t.id));
  }, [templates]);

  const categoryBreakdown = useMemo(() => {
    return computeCategoryBreakdown(expenses);
  }, [expenses]);

  const memberContributions = useMemo(() => {
    const memberItems = activeMembers.map((m) => ({
      memberId: m.id,
      displayName: resolveName(m),
    }));
    return computeMemberContributions(expenses, memberItems);
  }, [expenses, activeMembers, resolveName]);

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

  const handleOpenDetail = (insight: SmartInsight) => {
    setSelectedInsight(insight);
    setIsDetailOpen(true);
  };

  return (
    <PageContainer
      title="Analytics & Insights"
      description="Real-time financial summaries, predictive AI intelligence, spending trends, and granular ledger history in one unified dashboard."
    >
      <div className="flex flex-col gap-8">
        {/* Top selector filter & action bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-md shadow-lg">
          <div className="flex items-center gap-3">
            <label htmlFor="group-select" className="text-xs font-bold text-text-secondary uppercase tracking-wider">
              Select Group:
            </label>
            <select
              id="group-select"
              value={selectedGroupId}
              onChange={handleGroupChange}
              className="bg-background-dark border border-white/15 text-text-primary text-xs rounded-xl px-3.5 py-2.5 font-medium focus:outline-none focus:border-accent-indigo transition-all shadow-inner"
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
              <span className="text-xs text-warning bg-warning/15 px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 border border-warning/10 shadow-sm">
                <AlertCircle className="h-3.5 w-3.5 animate-pulse" />
                Offline Cached Data
              </span>
            )}
            <Button
              variant="secondary"
              disabled={isLoading || activeGroups.length === 0}
              onClick={() => setIsExportOpen(true)}
              className="flex items-center gap-2 text-xs font-semibold py-2 px-3.5 rounded-xl"
            >
              <Download className="h-4 w-4" />
              Export Group Data
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <BalanceCardSkeleton />
              <BalanceCardSkeleton />
              <BalanceCardSkeleton />
              <BalanceCardSkeleton />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InsightCardSkeleton />
              <InsightCardSkeleton />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartSkeleton />
              <ChartSkeleton />
              <ChartSkeleton />
              <ChartSkeleton />
            </div>
          </div>
        ) : activeGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border border-white/5 rounded-2xl bg-white/5 text-center">
            <Sparkles className="h-10 w-10 text-text-muted mb-2" />
            <p className="text-sm font-semibold text-text-secondary">No groups configured.</p>
            <p className="text-xs text-text-muted mt-1">Create or join a group to explore spending trends and insights.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {/* 1. Spending Summary KPI Overview */}
            <section className="flex flex-col gap-3">
              <SpendingSummaryCards summary={spendingSummary} currency={groupCurrency} formatAmount={formatAmount} />
            </section>

            {/* 2. Smart Financial Intelligence & Anomaly Detection */}
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/25">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-text-primary tracking-tight">
                      Smart Insights & Anomaly Detection
                    </h2>
                    <p className="text-xs text-text-muted">
                      Deterministic intelligence, budget variance warnings, and spending patterns
                    </p>
                  </div>
                </div>

                <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-surface-secondary border border-border-color text-text-secondary">
                  {displayInsights.length > 0 ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-accent-cyan animate-pulse" />
                      {displayInsights.length} {displayInsights.length === 1 ? "Insight" : "Insights"} Active
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      All Balanced
                    </>
                  )}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayInsights.map((insight) => (
                  <InsightCard key={insight.id} insight={insight} onExplain={handleOpenDetail} />
                ))}

                {displayInsights.length === 0 && (
                  <div className="col-span-full py-10 px-6 border border-dashed border-white/15 rounded-2xl bg-white/5 flex flex-col items-center justify-center text-center backdrop-blur-sm">
                    <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-400 mb-2 border border-emerald-500/20">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-semibold text-text-primary">All Accounts Well-Balanced</p>
                    <p className="text-xs text-text-muted mt-1 max-w-md">
                      No unusual spending anomalies, recurring spikes, or budget overruns detected in this group.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* 3. Deep Visual Charts & Breakdown Analysis */}
            <section className="flex flex-col gap-4">
              <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
                <div className="p-2 rounded-xl bg-accent-indigo/15 text-accent-indigo dark:text-accent-cyan border border-accent-indigo/25">
                  <BarChart2 className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-text-primary tracking-tight">
                    Spending Trends & Allocations
                  </h2>
                  <p className="text-xs text-text-muted">
                    Category splits, monthly trajectory, and individual member contribution shares
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CategoryBreakdownChart breakdown={categoryBreakdown} formatAmount={formatAmount} />
                <SpendingTrendChart trend={monthlyComparison} formatAmount={formatAmount} />
                <MemberContributionPanel contributions={memberContributions} formatAmount={formatAmount} />
                <MonthlyComparisonCard trend={monthlyComparison} formatAmount={formatAmount} />
              </div>
            </section>

            {/* 4. Complete Historical Ledgers & Balance Summary Records */}
            <section className="flex flex-col gap-4">
              <HistoricalLedgerAndBalanceSection
                group={group}
                members={members}
                expenses={expenses}
                settlements={settlements}
                resolveName={resolveName}
              />
            </section>
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

      <InsightExplanationDialog
        isOpen={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        insight={selectedInsight}
        currency={group ? group.baseCurrency : "USD"}
      />
    </PageContainer>
  );
};

export default AnalyticsPage;
