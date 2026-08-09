import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import { PageContainer } from "../../components/layout/PageContainer";
import { StatCard } from "../../components/ui/StatCard";
import { BalanceCard } from "../../components/ui/BalanceCard";
import { formatCurrency } from "../../utils/format";
import { ExpenseRow } from "../../components/ui/ExpenseRow";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Button, GradientButton } from "../../components/ui/Button";
import { MOCK_USER, MOCK_EXPENSES } from "../../mocks/mockData";
import { BalanceCardSkeleton, ExpenseRowSkeleton } from "../../components/ui/Skeleton";
import { useAppActions } from "../../app/providers/AppActionProvider";

export const OverviewPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const { openAddExpense } = useAppActions();

  useEffect(() => {
    const delay = typeof process !== "undefined" && process.env.NODE_ENV === "test" ? 0 : 800;
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  const triggerMockSync = () => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 1500)),
      {
        loading: "[Simulated] Synchronizing ledger with cloud...",
        success: "[Simulated] All local transactions successfully synchronized!",
        error: "Sync failed. Please retry later.",
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

  return (
    <PageContainer
      title="Dashboard"
      description="Every expense, fairly shared."
      action={
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={triggerMockSync} className="flex gap-2">
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
      {/* Balances Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <BalanceCard amountMinor={MOCK_USER.netBalanceMinor} currency={MOCK_USER.currency} />
        <BalanceCard amountMinor={MOCK_USER.owedMinor} currency={MOCK_USER.currency} label="You are owed total" />
        <BalanceCard amountMinor={-MOCK_USER.owesMinor} currency={MOCK_USER.currency} label="You owe total" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        {/* Recent Expenses List */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-text-primary uppercase tracking-wider">
              Recent Transactions
            </h3>
            <span className="text-xs text-text-muted">Showing last 5 entries</span>
          </div>
          <div className="flex flex-col gap-3">
            {MOCK_EXPENSES.map((expense) => (
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
                onResolveConflict={() =>
                  toast.success("Conflict Resolution Triggered", {
                    description: `Resolving edit collision for "${expense.title}" using cloud revision.`,
                  })
                }
              />
            ))}
          </div>
        </div>

        {/* Side Panel Stats & Settlement suggestion */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <h3 className="text-base font-bold text-text-primary uppercase tracking-wider">
              Insights & Quick Info
            </h3>
            <StatCard
              label="Active Splitting Groups"
              value="3 Groups"
              icon={<TrendingUp className="h-4 w-4 text-accent-cyan" />}
            />
          </div>

          <GlassPanel variant="standard" className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-accent-indigo">
              <Sparkles className="h-5 w-5 shrink-0" />
              <h4 className="text-sm font-bold text-text-primary">Suggested Settlement</h4>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Based on overall balances, you can settle your debt in Apartment 4B:
            </p>
            <div className="p-3.5 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between text-xs">
              <div>
                <p className="font-semibold text-text-primary">Pay Kunal Sen</p>
                <p className="text-text-muted mt-0.5 text-[10px]">Via UPI or Cash</p>
              </div>
              <span className="font-bold text-danger financial-number">
                {formatCurrency(42000, "INR")}
              </span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="w-full text-xs font-semibold py-2 mt-1"
              onClick={() => toast.success("Recording settlement of ₹420.00 to Kunal Sen.")}
            >
              Record Settlement Payment
            </Button>
          </GlassPanel>
        </div>
      </div>
    </PageContainer>
  );
};
export default OverviewPage;
