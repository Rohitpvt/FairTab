import React from "react";
import { calculateBalances } from "@fairtab/domain";
import type { ExpenseDocument, SettlementDocument } from "@fairtab/domain";
import type { GroupMemberDocument } from "../groups/memberSchema";
import { Scale } from "lucide-react";

interface BalanceProjectionCardProps {
  expenses: ExpenseDocument[];
  settlements: SettlementDocument[];
  members: GroupMemberDocument[];
  baseCurrency: string;
}

export const BalanceProjectionCard: React.FC<BalanceProjectionCardProps> = ({
  expenses,
  settlements,
  members,
  baseCurrency,
}) => {
  const activeExpenses = expenses.filter((e) => e.status !== "voided");
  const memberIds = members.map((m) => m.id);
  const calculatedBalances = calculateBalances(activeExpenses, settlements, memberIds);
  const balances = calculatedBalances.reduce((acc, b) => {
    acc[b.memberId] = b.netBaseMinor;
    return acc;
  }, {} as Record<string, number>);

  // Helper to format currency
  const formatCurrency = (minorAmount: number, currency: string) => {
    const amount = minorAmount / 100;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  };

  return (
    <div className="glass-elevated border border-white/10 rounded-2xl p-6 text-left">
      <h3 className="text-base font-bold text-text-primary flex items-center gap-2 mb-4">
        <Scale className="h-4 w-4 text-accent-cyan" />
        Balance Projection ({baseCurrency})
      </h3>

      <div className="flex flex-col gap-3">
        {members.map((member) => {
          const balance = balances[member.id] || 0;
          const isPositive = balance > 0;
          const isNegative = balance < 0;

          return (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl"
            >
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-text-primary">
                  {member.displayName}
                </span>
                <span className="text-[10px] text-text-muted capitalize">
                  {member.kind === "placeholder" ? "Offline Placeholder" : member.role}
                </span>
              </div>

              <div className="text-right">
                <span
                  className={`text-sm font-bold ${
                    isPositive
                      ? "text-success"
                      : isNegative
                        ? "text-danger"
                        : "text-text-muted"
                  }`}
                >
                  {isPositive ? "+" : ""}
                  {formatCurrency(balance, baseCurrency)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default BalanceProjectionCard;
