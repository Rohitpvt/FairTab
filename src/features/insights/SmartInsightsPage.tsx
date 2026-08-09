import React, { useState, useEffect, useMemo } from "react";
import { PageContainer } from "../../components/layout/PageContainer";
import { Sparkles, AlertCircle } from "lucide-react";
import { groupService } from "../../infrastructure/firebase/groupService";
import { expenseService } from "../../infrastructure/firebase/expenseService";
import { settlementService } from "../../infrastructure/firebase/settlementService";
import { budgetService } from "../../infrastructure/firebase/budgetService";
import { recurringService } from "../../infrastructure/firebase/recurringService";
import { auth } from "../../infrastructure/firebase/firebase";
import { generateSmartInsights } from "@fairtab/domain";
import type {
  SmartInsight,
  InsightType,
  InsightSeverity,
  ExpenseDocument,
  SettlementDocument,
  RecurringTemplateDocument,
  RecurringOccurrenceDocument,
  BudgetDocument,
} from "@fairtab/domain";
import type { GroupDocument } from "../groups/groupSchema";
import type { GroupMemberDocument } from "../groups/memberSchema";
import { offlineDb } from "../../infrastructure/offline/db";
import type { OfflineInsight } from "../../infrastructure/offline/db";
import { InsightCard } from "./InsightCard";
import { InsightExplanationDialog } from "./InsightDetailDialogs";

export const SmartInsightsPage: React.FC = () => {
  const [activeGroups, setActiveGroups] = useState<{ groupId: string; groupName: string }[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [group, setGroup] = useState<GroupDocument | null>(null);
  const [members, setMembers] = useState<GroupMemberDocument[]>([]);
  const [expenses, setExpenses] = useState<ExpenseDocument[]>([]);
  const [settlements, setSettlements] = useState<SettlementDocument[]>([]);
  const [budgets, setBudgets] = useState<BudgetDocument[]>([]);
  const [templates, setTemplates] = useState<RecurringTemplateDocument[]>([]);
  const [approvedOccurrences, setApprovedOccurrences] = useState<RecurringOccurrenceDocument[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineCached, setIsOfflineCached] = useState(false);
  const [offlineInsights, setOfflineInsights] = useState<SmartInsight[]>([]);

  const [selectedInsight, setSelectedInsight] = useState<SmartInsight | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // 1. Fetch Active Groups
  useEffect(() => {
    const unsub = groupService.watchUserGroups((groups) => {
      const active = groups.filter((g) => g.status === "active");
      setActiveGroups(active);
      if (active.length > 0 && !selectedGroupId) {
        setSelectedGroupId(active[0].groupId);
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const unsubBudgets = budgetService.watchBudgets(selectedGroupId, (b, fromCache) => {
      setBudgets(b);
      setIsOfflineCached(fromCache);
    });

    const unsubExpenses = expenseService.watchExpenses(selectedGroupId, (exp) => {
      setExpenses(exp);
    });

    const unsubSettlements = settlementService.watchSettlements(selectedGroupId, (settles) => {
      setSettlements(settles);
    });

    // Fetch recurring templates
    const unsubTemplates = recurringService.watchTemplates(selectedGroupId, (temps) => {
      setTemplates(temps);
    });

    return () => {
      unsubGroup();
      unsubMembers();
      unsubBudgets();
      unsubExpenses();
      unsubSettlements();
      unsubTemplates();
    };
  }, [selectedGroupId]);

  // 3. Watch approved occurrences for active templates in the group
  useEffect(() => {
    if (!selectedGroupId || templates.length === 0) {
      setTimeout(() => {
        setApprovedOccurrences([]);
        if (selectedGroupId) {
          setIsLoading(false);
        }
      }, 0);
      return;
    }

    const unsubOccurrences = recurringService.watchAllApprovedOccurrences(
      selectedGroupId,
      templates,
      (occs) => {
        setApprovedOccurrences(occs);
        setIsLoading(false);
      }
    );

    return () => unsubOccurrences();
  }, [selectedGroupId, templates]);

  // 4. Fetch offline cache from IndexedDB smartInsights table
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

  // 5. Compute Smart Insights dynamically (useMemo only, no side-effects)
  const computedInsights = useMemo(() => {
    if (!selectedGroupId || !group || members.length === 0) {
      return [];
    }

    // Convert members array to expected format { id, displayName }
    const engineMembers = members.map((m) => ({
      id: m.id,
      displayName: m.displayName,
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
  }, [selectedGroupId, group, expenses, settlements, members, budgets, templates, approvedOccurrences]);

  // 6. Persist insights changes in an Effect to avoid render side-effects
  useEffect(() => {
    const saveCachedInsights = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid || !selectedGroupId || computedInsights.length === 0) return;
      try {
        // Delete previous insights of this group for this user
        await offlineDb.smartInsights
          .where("uid")
          .equals(uid)
          .and((item: OfflineInsight) => item.groupId === selectedGroupId)
          .delete();

        // Save new computed insights
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

  // Derived display insights: use computed if available, fallback to offline cached insights
  const displayInsights = useMemo(() => {
    if (computedInsights.length > 0) {
      return computedInsights;
    }
    return offlineInsights;
  }, [computedInsights, offlineInsights]);

  const handleGroupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedGroupId(e.target.value);
  };

  const handleOpenDetail = (insight: SmartInsight) => {
    setSelectedInsight(insight);
    setIsDetailOpen(true);
  };

  return (
    <PageContainer
      title="Smart Insights"
      description="Deterministic financial intelligence and anomaly detection powered by your group ledger."
    >
      <div className="flex flex-col gap-6">
        {/* Top selector filter bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/5 border border-white/10 p-4 rounded-xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <label htmlFor="insight-group-select" className="text-xs font-bold text-text-secondary uppercase tracking-wider">
              Select Group:
            </label>
            <select
              id="insight-group-select"
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
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="h-8 w-8 rounded-full border-2 border-accent-indigo border-t-transparent animate-spin" />
            <span className="text-xs text-text-muted">Analyzing ledger data...</span>
          </div>
        ) : activeGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border border-white/5 rounded-xl bg-white/5 text-center">
            <Sparkles className="h-10 w-10 text-text-muted mb-2" />
            <p className="text-sm font-semibold text-text-secondary">No groups configured.</p>
            <p className="text-xs text-text-muted mt-1">Join a group to enable insights.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {displayInsights.map((insight) => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  onExplain={handleOpenDetail}
                />
              ))}

              {displayInsights.length === 0 && (
                <div className="col-span-full py-16 border border-dashed border-white/10 rounded-xl bg-white/5 flex flex-col items-center justify-center text-center">
                  <Sparkles className="h-8 w-8 text-text-muted mb-2 animate-pulse" />
                  <p className="text-sm font-semibold text-text-secondary">No anomalies detected</p>
                  <p className="text-xs text-text-muted mt-1">Your ledger is well-balanced and matches expected baselines.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <InsightExplanationDialog
        isOpen={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        insight={selectedInsight}
        currency={group ? group.baseCurrency : "USD"}
      />
    </PageContainer>
  );
};
