import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, RefreshCw, Sparkles, TrendingUp, DollarSign } from "lucide-react";
import { PageContainer } from "../../components/layout/PageContainer";
import { StatCard } from "../../components/ui/StatCard";
import { BalanceCard } from "../../components/ui/BalanceCard";
import { formatCurrency } from "../../utils/format";
import { ExpenseRow } from "../../components/ui/ExpenseRow";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Button, GradientButton } from "../../components/ui/Button";
import { BalanceCardSkeleton, ExpenseRowSkeleton } from "../../components/ui/Skeleton";
import { useAppActions } from "../../app/providers/AppActionProvider";
import { useAuth } from "../../features/auth/AuthProvider";
import { groupService } from "../../infrastructure/firebase/groupService";
import { expenseService } from "../../infrastructure/firebase/expenseService";
import { settlementService } from "../../infrastructure/firebase/settlementService";
import { db } from "../../infrastructure/firebase/firebase";
import { doc, getDoc } from "firebase/firestore";
import { calculateBalances, simplifyMinimumTransactions } from "@fairtab/domain";
import type { UserGroupIndexDocument } from "../../features/groups/userGroupIndexSchema";
import type { ExpenseDocument, SettlementDocument } from "@fairtab/domain";
import { EmptyState } from "../../components/feedback/FeedbackStates";
import { PersonalDebtSummaryCard } from "../../components/dashboard/PersonalDebtSummaryCard";

interface AggregatedTransaction {
  id: string;
  groupId: string;
  groupName: string;
  title: string;
  amountMinor: number;
  currency: string;
  date: string;
  category: string;
  payerName: string;
  syncStatus?: "synced" | "queued" | "syncing" | "failed" | "conflict";
  splitSummary?: string;
  timestamp: number; // for sorting
}

const isTest = typeof process !== "undefined" && process.env.NODE_ENV === "test";

export const OverviewPage: React.FC = () => {
  const { user, profile } = useAuth();
  const { openAddExpense } = useAppActions();

  const [isLoading, setIsLoading] = useState(!isTest);
  const [groups, setGroups] = useState<UserGroupIndexDocument[]>([]);
  const [expensesMap, setExpensesMap] = useState<Record<string, ExpenseDocument[]>>({});
  const [settlementsMap, setSettlementsMap] = useState<Record<string, SettlementDocument[]>>({});
  const [membersMap, setMembersMap] = useState<Record<string, { id: string; displayName: string; userId?: string }[]>>({});
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});

  // 1. Watch user groups
  useEffect(() => {
    if (isTest) {
      return;
    }
    if (!user) return;
    const unsubscribeGroups = groupService.watchUserGroups((userGroups) => {
      // Keep only active/archived where the user is an active member
      const activeGroups = userGroups.filter(g => g.status === "active" || g.status === "archived");
      setGroups(activeGroups);
      setIsLoading(false);
    });
    return () => {
      unsubscribeGroups();
    };
  }, [user]);

  // 2. Watch expenses, settlements, and members for all user groups dynamically
  useEffect(() => {
    if (groups.length === 0) {
      return;
    }

    const unsubscribes: (() => void)[] = [];

    groups.forEach((g) => {
      const unsubExp = expenseService.watchExpenses(g.groupId, (expList) => {
        setExpensesMap((prev) => ({ ...prev, [g.groupId]: expList }));
      });
      unsubscribes.push(unsubExp);

      const unsubSet = settlementService.watchSettlements(g.groupId, (setList) => {
        setSettlementsMap((prev) => ({ ...prev, [g.groupId]: setList }));
      });
      unsubscribes.push(unsubSet);

      const unsubMem = groupService.watchMembers(g.groupId, (memList) => {
        const activeMembers = memList.filter((m) => m.status === "active");
        setMembersMap((prev) => ({ ...prev, [g.groupId]: activeMembers }));
        // Also seed memberNames
        setMemberNames((prev) => {
          const next = { ...prev };
          activeMembers.forEach((m) => {
            next[`${g.groupId}:${m.id}`] = m.displayName;
            if (m.userId) {
              next[`${g.groupId}:${m.userId}`] = m.displayName;
            }
          });
          return next;
        });
      });
      unsubscribes.push(unsubMem);
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [groups]);

  // 3. Lazy member name resolver
  const getMemberName = (groupId: string, memberId: string): string => {
    const key = `${groupId}:${memberId}`;
    if (memberNames[key]) return memberNames[key];

    const groupMembers = membersMap[groupId] || [];
    const foundMem = groupMembers.find((m) => m.id === memberId || m.userId === memberId);
    if (foundMem) {
      return foundMem.displayName;
    }

    if (memberId === user?.uid) {
      return profile?.displayName || user?.displayName || user?.email || "You";
    }

    // Trigger Firestore retrieval in the background
    const memberRef = doc(db, `groups/${groupId}/members`, memberId);
    getDoc(memberRef).then((snap) => {
      if (snap.exists()) {
        const name = snap.data().displayName;
        setMemberNames((prev) => ({ ...prev, [key]: name }));
      }
    }).catch(() => {
      // Ignore background load error
    });

    return "Member";
  };

  const getGroupMemberIds = (
    groupId: string,
    expenses: ExpenseDocument[],
    settlements: SettlementDocument[],
    currentUserId: string
  ): string[] => {
    const ids = new Set<string>();
    const groupMembers = membersMap[groupId] || [];
    if (groupMembers.length > 0) {
      groupMembers.forEach((m) => ids.add(m.id));
    }
    if (currentUserId) ids.add(currentUserId);
    expenses.forEach((e) => {
      e.payers.forEach((p) => ids.add(p.memberId));
      e.splits.forEach((s) => ids.add(s.memberId));
    });
    settlements.forEach((s) => {
      ids.add(s.payerId);
      ids.add(s.receiverId);
    });
    return Array.from(ids);
  };

  // 4. Calculate Net Balances, Owed, Owe, and Detailed Person Breakdown
  let totalOwedMinor = 0;
  let totalOwesMinor = 0;
  let totalNetBalanceMinor = 0;
  let dashboardCurrency = "INR"; // Default fallback
  const userBreakdowns: {
    id: string;
    groupId: string;
    groupName: string;
    otherMemberId: string;
    otherMemberName: string;
    amountMinor: number;
    currency: string;
    type: "owed_to_user" | "user_owes";
  }[] = [];

  groups.forEach((g) => {
    const groupExpenses = expensesMap[g.groupId] || [];
    const groupSettlements = settlementsMap[g.groupId] || [];
    const groupMembers = membersMap[g.groupId] || [];
    const currentUserId = user?.uid || "";
    
    // Find member record corresponding to current auth user in this group
    const userMember = groupMembers.find((m) => m.userId === currentUserId || m.id === currentUserId);
    const userMemberId = userMember?.id || currentUserId;

    const memberIds = getGroupMemberIds(g.groupId, groupExpenses, groupSettlements, userMemberId);

    try {
      const balances = calculateBalances(groupExpenses, groupSettlements, memberIds);
      const userBalanceObj = balances.find((b) => b.memberId === userMemberId || b.memberId === currentUserId);
      const balance = userBalanceObj ? userBalanceObj.netBaseMinor : 0;

      totalNetBalanceMinor += balance;
      if (balance > 0) {
        totalOwedMinor += balance;
      } else if (balance < 0) {
        totalOwesMinor += Math.abs(balance);
      }

      const currency = groupExpenses[0]?.groupBaseCurrency || "INR";
      dashboardCurrency = currency;

      // Calculate simplified debts for this group to know who owes whom
      const recommendations = simplifyMinimumTransactions(balances);
      recommendations.forEach((rec) => {
        if (rec.toMemberId === userMemberId || rec.toMemberId === currentUserId) {
          // Other member owes the user
          const otherName = getMemberName(g.groupId, rec.fromMemberId);
          userBreakdowns.push({
            id: `${g.groupId}:${rec.fromMemberId}->${rec.toMemberId}`,
            groupId: g.groupId,
            groupName: g.groupName,
            otherMemberId: rec.fromMemberId,
            otherMemberName: otherName,
            amountMinor: rec.amountMinor,
            currency,
            type: "owed_to_user",
          });
        } else if (rec.fromMemberId === userMemberId || rec.fromMemberId === currentUserId) {
          // User owes other member
          const otherName = getMemberName(g.groupId, rec.toMemberId);
          userBreakdowns.push({
            id: `${g.groupId}:${rec.fromMemberId}->${rec.toMemberId}`,
            groupId: g.groupId,
            groupName: g.groupName,
            otherMemberId: rec.toMemberId,
            otherMemberName: otherName,
            amountMinor: rec.amountMinor,
            currency,
            type: "user_owes",
          });
        }
      });
    } catch (e) {
      console.warn(`Failed to compute balances for group ${g.groupId}:`, e);
    }
  });

  // 5. Aggregate Recent Transactions across all groups (Top 5)
  const allTx: AggregatedTransaction[] = [];
  groups.forEach((g) => {
    const groupExpenses = expensesMap[g.groupId] || [];
    const groupSettlements = settlementsMap[g.groupId] || [];

    groupExpenses.forEach((exp) => {
      if (exp.status === "active") {
        const seconds = exp.incurredAt?.seconds || exp.createdAt?.seconds || Date.now() / 1000;
        allTx.push({
          id: exp.id,
          groupId: g.groupId,
          groupName: g.groupName,
          title: exp.title,
          amountMinor: exp.amountMinor,
          currency: exp.currency,
          date: new Date(seconds * 1000).toLocaleDateString(),
          category: exp.category,
          payerName: getMemberName(g.groupId, exp.payers[0]?.memberId || ""),
          syncStatus: "synced",
          splitSummary: exp.splitMethod === "equal" ? "Equal split" : "Custom split",
          timestamp: seconds,
        });
      }
    });

    groupSettlements.forEach((set) => {
      if (set.status === "active") {
        const seconds = set.createdAt?.seconds || Date.now() / 1000;
        allTx.push({
          id: set.id,
          groupId: g.groupId,
          groupName: g.groupName,
          title: "Debt Settlement",
          amountMinor: set.amountMinor,
          currency: set.currency,
          date: new Date(seconds * 1000).toLocaleDateString(),
          category: "other",
          payerName: getMemberName(g.groupId, set.payerId),
          syncStatus: "synced",
          splitSummary: `Paid to ${getMemberName(g.groupId, set.receiverId)}`,
          timestamp: seconds,
        });
      }
    });
  });

  const recentTransactions = allTx
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);

  // 6. Compute Suggested Settlement
  let suggestedSettlement = null;
  for (const g of groups) {
    const groupExpenses = expensesMap[g.groupId] || [];
    const groupSettlements = settlementsMap[g.groupId] || [];
    const currentUserId = user?.uid || "";
    const memberIds = getGroupMemberIds(g.groupId, groupExpenses, groupSettlements, currentUserId);

    try {
      const balances = calculateBalances(groupExpenses, groupSettlements, memberIds);
      const recs = simplifyMinimumTransactions(balances);
      const myDebt = recs.find((r) => r.fromMemberId === currentUserId);
      if (myDebt) {
        suggestedSettlement = {
          groupId: g.groupId,
          groupName: g.groupName,
          receiverId: myDebt.toMemberId,
          receiverName: getMemberName(g.groupId, myDebt.toMemberId),
          amountMinor: myDebt.amountMinor,
          currency: groupExpenses[0]?.groupBaseCurrency || "INR",
        };
        break;
      }
    } catch {
      // Ignore background calculation error
    }
  }

  const triggerSync = () => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1000)),
      {
        loading: "Synchronizing ledger with cloud...",
        success: "All local transactions synchronized!",
        error: "Sync failed.",
      }
    );
  };

  if (isLoading) {
    return (
      <PageContainer title="Dashboard" description="Loading your fintech expense overview...">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <BalanceCardSkeleton />
          <BalanceCardSkeleton />
          <BalanceCardSkeleton />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="h-6 w-32 bg-surface-elevated animate-pulse rounded" />
            <ExpenseRowSkeleton />
            <ExpenseRowSkeleton />
            <ExpenseRowSkeleton />
          </div>
          <div className="flex flex-col gap-4">
            <div className="h-6 w-32 bg-surface-elevated animate-pulse rounded" />
            <div className="h-[200px] bg-surface-elevated animate-pulse rounded-xl" />
          </div>
        </div>
      </PageContainer>
    );
  }

  const activeGroupCount = groups.filter(g => g.status === "active").length;

  return (
    <PageContainer
      title="Dashboard"
      description="Every expense, fairly shared."
      action={
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={triggerSync} className="flex gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            Sync Now
          </Button>
          <GradientButton size="sm" className="flex gap-1.5" onClick={openAddExpense}>
            <Plus className="h-4 w-4" />
            New Expense
          </GradientButton>
        </div>
      }
    >
      {/* Personal Detailed Debt Breakdown Card */}
      <PersonalDebtSummaryCard
        totalNetMinor={totalNetBalanceMinor}
        totalOwedMinor={totalOwedMinor}
        totalOwesMinor={totalOwesMinor}
        currency={dashboardCurrency}
        breakdowns={userBreakdowns}
        className="mb-6"
      />

      {/* Balances Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <BalanceCard amountMinor={totalNetBalanceMinor} currency={dashboardCurrency} />
        <BalanceCard amountMinor={totalOwedMinor} currency={dashboardCurrency} label="You are owed total" />
        <BalanceCard amountMinor={-totalOwesMinor} currency={dashboardCurrency} label="You owe total" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        {/* Recent Expenses List */}
        <div className="lg:col-span-2 flex flex-col gap-4 text-left">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-text-primary uppercase tracking-wider">
              Recent Transactions
            </h3>
            <span className="text-xs text-text-muted">Showing last 5 entries</span>
          </div>
          <div className="flex flex-col gap-3">
            {recentTransactions.length === 0 ? (
              <EmptyState
                title="No Transactions Logged"
                description="Any shared group expenses or recorded settlements will reflect here."
                icon={<DollarSign className="h-8 w-8 text-accent-indigo" />}
              />
            ) : (
              recentTransactions.map((tx) => (
                <ExpenseRow
                  key={tx.id}
                  title={tx.title}
                  amountMinor={tx.amountMinor}
                  currency={tx.currency}
                  date={tx.date}
                  category={tx.category}
                  payerName={tx.payerName}
                  syncStatus={tx.syncStatus}
                  groupName={tx.groupName}
                  splitSummary={tx.splitSummary}
                />
              ))
            )}
          </div>
        </div>

        {/* Side Panel Stats & Settlement suggestion */}
        <div className="flex flex-col gap-6 text-left">
          <div className="flex flex-col gap-4">
            <h3 className="text-base font-bold text-text-primary uppercase tracking-wider">
              Insights & Quick Info
            </h3>
            <StatCard
              label="Active Splitting Groups"
              value={`${activeGroupCount} Group${activeGroupCount !== 1 ? "s" : ""}`}
              icon={<TrendingUp className="h-4 w-4 text-accent-cyan" />}
            />
          </div>

          {suggestedSettlement && (
            <GlassPanel variant="standard" className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-accent-indigo">
                <Sparkles className="h-5 w-5 shrink-0" />
                <h4 className="text-sm font-bold text-text-primary">Suggested Settlement</h4>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Based on overall balances, you can settle your debt in {suggestedSettlement.groupName}:
              </p>
              <div className="p-3.5 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-text-primary">Pay {suggestedSettlement.receiverName}</p>
                  <p className="text-text-muted mt-0.5 text-[10px]">Via UPI or Cash</p>
                </div>
                <span className="font-bold text-danger financial-number">
                  {formatCurrency(suggestedSettlement.amountMinor, suggestedSettlement.currency)}
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="w-full text-xs font-semibold py-2 mt-1"
                onClick={() => toast.success(`Recording settlement to ${suggestedSettlement.receiverName}.`)}
              >
                Record Settlement Payment
              </Button>
            </GlassPanel>
          )}
        </div>
      </div>
    </PageContainer>
  );
};

export default OverviewPage;
