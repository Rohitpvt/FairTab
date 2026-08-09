/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from "react";
import { PageContainer } from "../../components/layout/PageContainer";
import { groupService } from "../../infrastructure/firebase/groupService";
import { expenseService } from "../../infrastructure/firebase/expenseService";
import { budgetService } from "../../infrastructure/firebase/budgetService";
import { syncManager } from "../../infrastructure/offline/syncManager";
import { auth } from "../../infrastructure/firebase/firebase";
import type { GroupDocument } from "../groups/groupSchema";
import type { GroupMemberDocument } from "../groups/memberSchema";
import type { BudgetDocument, ExpenseDocument } from "@fairtab/domain";
import {
  getCurrentBudgetPeriod,
  filterExpensesByPeriod,
  computeBudgetProgress,
} from "@fairtab/domain";
import { BudgetProgressCard } from "./BudgetProgressCard";
import { CreateBudgetDialog } from "./CreateBudgetDialog";
import { Button } from "../../components/ui/Button";
import { Plus, Wallet, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const BudgetDashboard: React.FC = () => {
  const [activeGroups, setActiveGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [group, setGroup] = useState<GroupDocument | null>(null);
  const [members, setMembers] = useState<GroupMemberDocument[]>([]);
  const [budgets, setBudgets] = useState<BudgetDocument[]>([]);
  const [expenses, setExpenses] = useState<ExpenseDocument[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineCached, setIsOfflineCached] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

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

    const unsubBudgets = budgetService.watchBudgets(selectedGroupId, (b, fromCache) => {
      setBudgets(b);
      setIsOfflineCached(fromCache);
      setIsLoading(false);
    });

    const unsubExpenses = expenseService.watchExpenses(selectedGroupId, (exp) => {
      setExpenses(exp);
    });

    return () => {
      unsubGroup();
      unsubMembers();
      unsubBudgets();
      unsubExpenses();
    };
  }, [selectedGroupId]);

  // Derived attributes
  const isArchived = useMemo(() => {
    return group ? (group.status === "archived" || group.status === "deleted") : false;
  }, [group]);

  const currentUserMember = useMemo(() => {
    return members.find((m) => m.userId === auth.currentUser?.uid) || null;
  }, [members]);

  const isOwnerOrAdmin = useMemo(() => {
    if (!currentUserMember) return false;
    return currentUserMember.role === "owner" || currentUserMember.role === "admin";
  }, [currentUserMember]);

  const budgetProgresses = useMemo(() => {
    return budgets.map((b) => {
      const { periodStart, periodEnd } = getCurrentBudgetPeriod(b);
      const periodExpenses = filterExpensesByPeriod(expenses, periodStart, periodEnd);
      const progress = computeBudgetProgress(b, periodExpenses);
      return { budget: b, progress };
    });
  }, [budgets, expenses]);

  const formatAmount = (minor: number) => {
    const currency = group ? group.baseCurrency : "USD";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(minor / 100);
  };

  const handleGroupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedGroupId(e.target.value);
  };

  // budget CRUD queue operations
  const handleCreateBudget = async (data: any) => {
    if (!selectedGroupId || isArchived) return;

    // Client-side validation: if scope is member, verify active user matches
    if (data.scope === "member" && currentUserMember) {
      if (!isOwnerOrAdmin && data.memberId !== currentUserMember.id) {
        toast.error("You can only create personal budgets for yourself.");
        return;
      }
    }

    const budgetId = `bgt-${Math.random().toString(36).substring(2, 11)}`;
    const clientOperationId = `op-create-budget-${budgetId}-${Date.now()}`;

    const payload = {
      clientOperationId,
      groupId: selectedGroupId,
      budgetId,
      currency: group?.baseCurrency || "USD",
      ...data,
    };

    try {
      await syncManager.queueCreateBudget(selectedGroupId, payload);
      toast.success("Budget creation queued.");
    } catch (err) {
      toast.error("Failed to queue budget creation.");
      console.error(err);
    }
  };

  const handleToggleStatus = async (budget: BudgetDocument) => {
    if (isArchived) return;

    // Check permissions
    if (!isOwnerOrAdmin) {
      if (budget.scope === "member" && currentUserMember && budget.memberId === currentUserMember.id) {
        // Allow
      } else {
        toast.error("Permission denied. Only owners or admins can toggle group budgets.");
        return;
      }
    }

    const nextStatus = budget.status === "active" ? "paused" : "active";
    const clientOperationId = `op-update-budget-${budget.id}-${Date.now()}`;

    const payload = {
      clientOperationId,
      groupId: selectedGroupId,
      budgetId: budget.id,
      expectedVersion: budget.version,
      name: budget.name,
      scope: budget.scope,
      category: budget.category,
      memberId: budget.memberId,
      period: budget.period,
      timeZone: budget.timeZone,
      startDate: budget.startDate,
      endDate: budget.endDate,
      amountMinor: budget.amountMinor,
      currency: budget.currency,
      status: nextStatus,
    };

    try {
      await syncManager.queueUpdateBudget(selectedGroupId, payload);
      toast.success(`Budget ${nextStatus === "paused" ? "paused" : "resumed"} queued.`);
    } catch (err) {
      toast.error("Failed to queue status toggle.");
      console.error(err);
    }
  };

  const handleDeleteBudget = async (budget: BudgetDocument) => {
    if (isArchived) return;

    // Check permissions
    if (!isOwnerOrAdmin) {
      if (budget.scope === "member" && currentUserMember && budget.memberId === currentUserMember.id) {
        // Allow
      } else {
        toast.error("Permission denied. Only owners or admins can delete group budgets.");
        return;
      }
    }

    const clientOperationId = `op-delete-budget-${budget.id}-${Date.now()}`;
    const payload = {
      clientOperationId,
      groupId: selectedGroupId,
      budgetId: budget.id,
      expectedVersion: budget.version,
    };

    try {
      await syncManager.queueDeleteBudget(selectedGroupId, payload);
      toast.success("Budget deletion queued.");
    } catch (err) {
      toast.error("Failed to queue deletion.");
      console.error(err);
    }
  };

  return (
    <PageContainer
      title="Budgets & Limits"
      description="Manage shared expenses using category budgets or personal contribution boundaries."
    >
      <div className="flex flex-col gap-6">
        {/* Top selector filter bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/5 border border-white/10 p-4 rounded-xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <label htmlFor="budget-group-select" className="text-xs font-bold text-text-secondary uppercase tracking-wider">
              Select Group:
            </label>
            <select
              id="budget-group-select"
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
              variant="primary"
              disabled={isLoading || activeGroups.length === 0 || isArchived}
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 text-xs"
            >
              <Plus className="h-4 w-4" />
              New Budget
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="h-8 w-8 rounded-full border-2 border-accent-indigo border-t-transparent animate-spin" />
            <span className="text-xs text-text-muted">Loading budgets...</span>
          </div>
        ) : activeGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border border-white/5 rounded-xl bg-white/5 text-center">
            <Wallet className="h-10 w-10 text-text-muted mb-2" />
            <p className="text-sm font-semibold text-text-secondary">No groups configured.</p>
            <p className="text-xs text-text-muted mt-1">Join a group to manage budgets.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {isArchived && (
              <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg text-xs text-warning">
                <AlertCircle className="h-4 w-4 shrink-0" />
                This group is archived. All budgets are read-only and cannot be created, toggled, or deleted.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {budgetProgresses.map(({ budget, progress }) => (
                <BudgetProgressCard
                  key={budget.id}
                  progress={progress}
                  budget={budget}
                  formatAmount={formatAmount}
                  onToggleStatus={handleToggleStatus}
                  onDelete={handleDeleteBudget}
                  isOwnerOrAdmin={isOwnerOrAdmin || (budget.scope === "member" && currentUserMember?.id === budget.memberId)}
                />
              ))}

              {budgetProgresses.length === 0 && (
                <div className="col-span-full py-16 border border-dashed border-white/10 rounded-xl bg-white/5 flex flex-col items-center justify-center text-center">
                  <Wallet className="h-8 w-8 text-text-muted mb-2" />
                  <p className="text-sm font-semibold text-text-secondary">No active budgets.</p>
                  <p className="text-xs text-text-muted mt-1">Define an overall or category-specific budget to track spending.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <CreateBudgetDialog
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        members={members}
        onSubmit={handleCreateBudget}
        currency={group ? group.baseCurrency : "USD"}
      />
    </PageContainer>
  );
};

export default BudgetDashboard;
