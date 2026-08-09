import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Search, DollarSign, Filter, SlidersHorizontal } from "lucide-react";
import { PageContainer } from "../../components/layout/PageContainer";
import { ExpenseRow } from "../../components/ui/ExpenseRow";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/feedback/FeedbackStates";
import { MOCK_EXPENSES } from "../../mocks/mockData";
import { ExpenseRowSkeleton } from "../../components/ui/Skeleton";

export const ExpensesPage: React.FC = () => {
  const [expenses, setExpenses] = useState(MOCK_EXPENSES);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter State
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [syncFilter, setSyncFilter] = useState("all");
  const [isEmptySimulated, setIsEmptySimulated] = useState(false);

  useEffect(() => {
    const delay = typeof process !== "undefined" && process.env.NODE_ENV === "test" ? 0 : 800;
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  // Filter logic
  const filteredExpenses = expenses.filter((exp) => {
    const matchesSearch =
      exp.title.toLowerCase().includes(search.toLowerCase()) ||
      exp.groupName.toLowerCase().includes(search.toLowerCase()) ||
      exp.payerName.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || exp.category.toLowerCase() === categoryFilter.toLowerCase();
    const matchesSync = syncFilter === "all" || exp.syncStatus === syncFilter;

    return matchesSearch && matchesCategory && matchesSync;
  });

  const handleDemoToggle = () => {
    setIsEmptySimulated(!isEmptySimulated);
    toast.info(
      isEmptySimulated
        ? "Restored mock expenses listing."
        : "Simulated empty state for search results."
    );
  };

  const handleResolveConflict = (title: string) => {
    toast.success("Conflict Resolved", {
      description: `Synchronized "${title}" using cloud master details.`,
    });
    setExpenses((prev) =>
      prev.map((exp) => (exp.title === title ? { ...exp, syncStatus: "synced" } : exp))
    );
  };

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
      action={
        <Button variant="secondary" size="sm" onClick={handleDemoToggle}>
          {isEmptySimulated ? "Restore Data" : "Demo Empty List"}
        </Button>
      }
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
      {isEmptySimulated || filteredExpenses.length === 0 ? (
        <EmptyState
          title="No Matching Expenses"
          description="Could not locate any expense logs matching your search parameters or category filter filters."
          actionText="Clear Filters"
          onAction={() => {
            setSearch("");
            setCategoryFilter("all");
            setSyncFilter("all");
            setIsEmptySimulated(false);
          }}
          icon={<DollarSign className="h-8 w-8 text-accent-indigo" />}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filteredExpenses.map((expense) => (
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
