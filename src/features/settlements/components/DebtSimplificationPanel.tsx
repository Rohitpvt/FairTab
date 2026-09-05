import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight, Info, HelpCircle } from "lucide-react";
import { GlassPanel } from "../../../components/ui/GlassPanel";
import { Button } from "../../../components/ui/Button";
import { formatCurrency } from "../../../utils/format";
import {
  calculateBalances,
  simplifyMinimumTransactions,
  simplifyPreserveRelationships,
} from "@fairtab/domain";
import type { ExpenseDocument, SettlementDocument } from "@fairtab/domain";
import type { GroupMemberDocument } from "../../groups/memberSchema";
import { useMemberNameResolver } from "../../../hooks/useMemberNameResolver";

interface DebtSimplificationPanelProps {
  groupId: string;
  expenses: ExpenseDocument[];
  settlements: SettlementDocument[];
  members: GroupMemberDocument[];
  baseCurrency: string;
}

export const DebtSimplificationPanel: React.FC<DebtSimplificationPanelProps> = ({
  groupId,
  expenses,
  settlements,
  members,
  baseCurrency,
}) => {
  const navigate = useNavigate();
  const { resolveName } = useMemberNameResolver(members);
  const [strategy, setStrategy] = useState<"min_tx" | "preserve_rel">("min_tx");
  const [showExplanation, setShowExplanation] = useState(false);

  const activeMembers = members.filter((m) => m.status === "active");
  const memberIds = activeMembers.map((m) => m.id);

  // 1. Calculate base balances
  const balances = calculateBalances(expenses, settlements, memberIds);

  // 2. Run recommendations based on chosen strategy
  const recommendations =
    strategy === "min_tx"
      ? simplifyMinimumTransactions(balances)
      : simplifyPreserveRelationships(expenses, settlements, memberIds);

  const getMemberName = (id: string) => {
    const m = activeMembers.find((member) => member.id === id);
    if (!m) return id;
    return resolveName(m) + (m.kind === "placeholder" ? " (Placeholder)" : "");
  };

  const getMemberInitials = (id: string) => {
    const name = getMemberName(id);
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <GlassPanel variant="standard" className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent-cyan" />
          <div>
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
              Debt Optimization Plan
            </h3>
            <p className="text-[10px] text-text-muted mt-0.5">
              Choose a strategy to view suggested repayment transfers.
            </p>
          </div>
        </div>

        {/* Strategy Selector Toggles */}
        <div className="flex w-full sm:w-auto bg-surface-primary p-1 rounded-xl border border-white/5 shrink-0 gap-1">
          <button
            type="button"
            onClick={() => setStrategy("min_tx")}
            className={`flex-1 sm:flex-initial px-3 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center min-h-[36px] ${
              strategy === "min_tx"
                ? "bg-accent-cyan/15 text-accent-cyan shadow-sm border border-accent-cyan/20"
                : "text-text-secondary hover:text-text-primary hover:bg-white/5"
            }`}
          >
            Minimize Transfers
          </button>
          <button
            type="button"
            onClick={() => setStrategy("preserve_rel")}
            className={`flex-1 sm:flex-initial px-3 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center min-h-[36px] ${
              strategy === "preserve_rel"
                ? "bg-accent-indigo/15 text-accent-indigo shadow-sm border border-accent-indigo/20"
                : "text-text-secondary hover:text-text-primary hover:bg-white/5"
            }`}
          >
            Preserve Relationships
          </button>
        </div>
      </div>

      {/* Explanation Banner */}
      <div className="rounded-lg bg-white/5 border border-white/5 p-3 text-xs flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-text-secondary">
            <Info className="h-3.5 w-3.5 text-accent-cyan" />
            <span>
              {strategy === "min_tx" ? "Deterministic debt simplification" : "Pairwise Netting Strategy"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowExplanation(!showExplanation)}
            className="text-[10px] text-accent-cyan hover:underline flex items-center gap-0.5"
          >
            <HelpCircle className="h-3 w-3" />
            {showExplanation ? "Hide Details" : "Learn More"}
          </button>
        </div>

        {showExplanation && (
          <p className="text-text-muted leading-relaxed mt-1 text-[11px]">
            {strategy === "min_tx"
              ? "This strategy utilizes a deterministic greedy matcher (matching largest debtors with largest creditors) to simplify debt networks and minimize the total number of transactions. Note: While highly effective, a greedy heuristic is not mathematically guaranteed to find the absolute global minimum in all edge cases, but behaves deterministically."
              : "This strategy defines pairwise obligations directly from expense split data before aggregating them. Settlements reduce the corresponding payer → receiver obligation. This preserves the direct transactional relationships between members and never creates artificial or indirect self-transfers."}
          </p>
        )}
      </div>

      {/* Suggestions List */}
      <div className="flex flex-col gap-3">
        {recommendations.length === 0 ? (
          <div className="p-6 rounded-lg bg-white/5 border border-white/5 flex flex-col items-center justify-center text-center">
            <div className="h-9 w-9 rounded-full bg-success/15 text-success flex items-center justify-center font-bold text-sm mb-2">
              ✓
            </div>
            <p className="text-xs font-semibold text-text-primary">All Settled Up!</p>
            <p className="text-[10px] text-text-muted mt-0.5">
              There are no outstanding debts or recommendations.
            </p>
          </div>
        ) : (
          recommendations.map((rec, index) => (
            <div
              key={index}
              className="p-4 rounded-lg bg-white/5 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-danger/10 text-danger flex items-center justify-center font-bold text-xs">
                    {getMemberInitials(rec.fromMemberId)}
                  </div>
                  <ArrowRight className="h-3 w-3 text-text-muted" />
                  <div className="h-8 w-8 rounded-full bg-success/10 text-success flex items-center justify-center font-bold text-xs">
                    {getMemberInitials(rec.toMemberId)}
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-text-primary truncate">
                    {getMemberName(rec.fromMemberId)} pays {getMemberName(rec.toMemberId)}
                  </p>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    Recommended settlement under {strategy === "min_tx" ? "Deterministic debt simplification" : "Pairwise Netting"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 justify-between sm:justify-end">
                <span className="font-bold text-text-primary financial-number text-sm">
                  {formatCurrency(rec.amountMinor, baseCurrency)}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  className="text-xs py-1"
                  onClick={() =>
                    navigate(
                      `/groups/${groupId}/settlements/new?from=${rec.fromMemberId}&to=${rec.toMemberId}&amount=${(
                        rec.amountMinor / 100
                      ).toFixed(2)}`
                    )
                  }
                >
                  Settle
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </GlassPanel>
  );
};
