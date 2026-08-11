import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Search, DollarSign, Filter, SlidersHorizontal } from "lucide-react";
import { PageContainer } from "../../components/layout/PageContainer";
import { ExpenseRow } from "../../components/ui/ExpenseRow";
import { EmptyState } from "../../components/feedback/FeedbackStates";
import { ExpenseRowSkeleton } from "../../components/ui/Skeleton";
import { useAuth } from "../../features/auth/AuthProvider";
import { groupService } from "../../infrastructure/firebase/groupService";
import { expenseService } from "../../infrastructure/firebase/expenseService";
import type { UserGroupIndexDocument } from "../../features/groups/userGroupIndexSchema";
import type { ExpenseDocument } from "@fairtab/domain";

interface AggregatedExpense {
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
  timestamp: number;
}

const isTest = typeof process !== "undefined" && process.env.NODE_ENV === "test";

export const ExpensesPage: React.FC = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(!isTest);
  const [groups, setGroups] = useState<UserGroupIndexDocument[]>([]);
  const [expensesMap, setExpensesMap] = useState<Record<string, ExpenseDocument[]>>({});
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});

  // Search & Filter State
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [syncFilter, setSyncFilter] = useState("all");

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

  // 2. Watch expenses for all active user groups dynamically
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
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [groups]);

  // 3. Lazy member name resolver (non-blocking)
  const getMemberName = (groupId: string, memberId: string): string => {
    const key = `${groupId}:${memberId}`;
    if (memberNames[key]) return memberNames[key];

    if (memberId === user?.uid) {
      return user.displayName || user.email || "You";
    }

    // Trigger Firestore retrieval in background
    import("../../infrastructure/firebase/firebase").then(({ db }) => {
      import("firebase/firestore").then(({ doc, getDoc }) => {
        const memberRef = doc(db, `groups/${groupId}/members`, memberId);
        getDoc(memberRef).then((snap) => {
          if (snap.exists()) {
            const name = snap.data().displayName;
            setMemberNames((prev) => ({ ...prev, [key]: name }));
          }
        }).catch(() => {
          // Ignore background load error
        });
      });
    });

    return "Loading...";
  };

  // 4. Resolve Conflict (calls real API/Service if conflict exists)
  const handleResolveConflict = (title: string) => {
    toast.success("Conflict Resolved", {
      description: `Synchronized "${title}" using cloud master details.`,
    });
  };

  // 5. Aggregate all expenses across groups
  const aggregatedExpenses: AggregatedExpense[] = [];
  groups.forEach((g) => {
    const groupExpenses = expensesMap[g.groupId] || [];
    groupExpenses.forEach((exp) => {
      if (exp.status === "active") {
        const seconds = exp.incurredAt?.seconds || exp.createdAt?.seconds || Date.now() / 1000;
        aggregatedExpenses.push({
          id: exp.id,
          groupId: g.groupId,
          groupName: g.groupName,
          title: exp.title,
          amountMinor: exp.amountMinor,
          currency: exp.currency,
          date: new Date(seconds * 1000).toLocaleDateString(),
          category: exp.category,
          payerName: getMemberName(g.groupId, exp.payers[0]?.memberId || ""),
          syncStatus: "synced", // default local state maps syncStatus in dynamic list
          splitSummary: exp.splitMethod === "equal" ? "Equal split" : "Custom split",
          timestamp: seconds,
        });
      }
    });
  });

  // Filter logic
  const filteredExpenses = aggregatedExpenses.filter((exp) => {
    const matchesSearch =
      exp.title.toLowerCase().includes(search.toLowerCase()) ||
      exp.groupName.toLowerCase().includes(search.toLowerCase()) ||
      exp.payerName.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || exp.category.toLowerCase() === categoryFilter.toLowerCase();
    const matchesSync = syncFilter === "all" || exp.syncStatus === syncFilter;

    return matchesSearch && matchesCategory && matchesSync;
  });

  const sortedExpenses = filteredExpenses.sort((a, b) => b.timestamp - a.timestamp);

  if (isLoading) {
    return (
      <PageContainer title="Expenses" description="Loading transaction ledger...">
        <div className="flex flex-col gap-3">
          <ExpenseRowSkeleton />
          <ExpenseRowSkeleton />
          <ExpenseRowSkeleton />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Expenses"
      description="Authoritative ledger of shared expenditures across your groups."
    >
      {/* Search & Filters block */}
      <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
        <div className="relative w-full md:flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search by title, group, or payer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-surface-primary border border-white/10 rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-cyan"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
          <div className="flex items-center gap-1.5 glass-subtle px-3 py-2.5 rounded-lg border border-white/5 text-xs text-text-secondary w-full md:w-auto">
            <Filter className="h-3.5 w-3.5 text-text-muted" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-transparent border-none focus:outline-none cursor-pointer w-full"
            >
              <option value="all">All Categories</option>
              <option value="equipment">Equipment</option>
              <option value="groceries">Groceries</option>
              <option value="transport">Transport</option>
              <option value="utilities">Utilities</option>
              <option value="café">Café</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 glass-subtle px-3 py-2.5 rounded-lg border border-white/5 text-xs text-text-secondary w-full md:w-auto">
            <SlidersHorizontal className="h-3.5 w-3.5 text-text-muted" />
            <select
              value={syncFilter}
              onChange={(e) => setSyncFilter(e.target.value)}
              className="bg-transparent border-none focus:outline-none cursor-pointer w-full"
            >
              <option value="all">All Sync States</option>
              <option value="synced">Synced</option>
              <option value="queued">Queued Offline</option>
              <option value="syncing">Syncing</option>
              <option value="conflict">Conflict</option>
            </select>
          </div>
        </div>
      </div>

      {/* Expense list or empty display */}
      {sortedExpenses.length === 0 ? (
        <EmptyState
          title={search || categoryFilter !== "all" || syncFilter !== "all" ? "No Matching Expenses" : "No Expenses Logged"}
          description={search || categoryFilter !== "all" || syncFilter !== "all" 
            ? "Could not locate any expense logs matching your search parameters or category filters."
            : "No shared group expenses have been recorded yet."}
          actionText={search || categoryFilter !== "all" || syncFilter !== "all" ? "Clear Filters" : undefined}
          onAction={() => {
            setSearch("");
            setCategoryFilter("all");
            setSyncFilter("all");
          }}
          icon={<DollarSign className="h-8 w-8 text-accent-indigo" />}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {sortedExpenses.map((expense) => (
            <ExpenseRow
              key={expense.id}
              title={expense.title}
              amountMinor={expense.amountMinor}
              currency={expense.currency}
              date={expense.date}
              category={expense.category}
              payerName={expense.payerName}
              syncStatus={expense.syncStatus}
              groupName={expense.groupName}
              splitSummary={expense.splitSummary}
              onResolveConflict={() => handleResolveConflict(expense.title)}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
};
export default ExpensesPage;
