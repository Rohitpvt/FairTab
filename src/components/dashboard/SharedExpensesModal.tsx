import React from "react";
import { Link } from "react-router-dom";
import {
  Receipt,
  HandCoins,
  ChevronRight,
  User,
} from "lucide-react";
import { Dialog } from "../ui/Dialogs";
import { formatCurrency } from "../../utils/format";
import type { ExpenseDocument, SettlementDocument } from "@fairtab/domain";

export interface SharedTransactionItem {
  id: string;
  type: "expense" | "settlement";
  title: string;
  date: string;
  timestamp: number;
  groupId: string;
  groupName: string;
  totalAmountMinor: number;
  currency: string;
  category?: string;
  // Impact on the balance between currentUser and otherMember:
  // positive = otherMember owes currentUser more (e.g., currentUser paid upfront or other received a settlement)
  // negative = currentUser owes otherMember more (e.g., otherMember paid upfront or currentUser received a settlement)
  impactMinor: number;
  description: string;
}

interface SharedExpensesModalProps {
  isOpen: boolean;
  onClose: () => void;
  otherMemberName: string;
  otherMemberId: string;
  netBalanceMinor: number;
  currency: string;
  groupIds: string[];
  groupNames: Record<string, string>;
  expensesMap: Record<string, ExpenseDocument[]>;
  settlementsMap: Record<string, SettlementDocument[]>;
  currentUserId: string;
  resolveMemberName?: (groupId: string, memberId: string) => string;
}

export const SharedExpensesModal: React.FC<SharedExpensesModalProps> = ({
  isOpen,
  onClose,
  otherMemberName,
  otherMemberId,
  netBalanceMinor,
  currency,
  groupIds,
  groupNames,
  expensesMap,
  settlementsMap,
  currentUserId,
}) => {
  // Compute all transactions involving both currentUser and otherMember
  const transactions = React.useMemo(() => {
    const list: SharedTransactionItem[] = [];

    groupIds.forEach((groupId) => {
      const gName = groupNames[groupId] || "Group";
      const groupExpenses = expensesMap[groupId] || [];
      const groupSettlements = settlementsMap[groupId] || [];

      // 1. Process Expenses
      groupExpenses.forEach((exp) => {
        if (exp.status === "voided") return;

        // Check if both users are involved in this expense
        const isUserPayer = exp.payers.some(
          (p) => p.memberId === currentUserId
        );
        const isOtherPayer = exp.payers.some(
          (p) => p.memberId === otherMemberId
        );
        const userSplit = exp.splits.find(
          (s) => s.memberId === currentUserId
        );
        const otherSplit = exp.splits.find(
          (s) => s.memberId === otherMemberId
        );

        const isUserInvolved = isUserPayer || !!userSplit;
        const isOtherInvolved = isOtherPayer || !!otherSplit;

        if (!isUserInvolved || !isOtherInvolved) return;

        const seconds =
          exp.incurredAt?.seconds || exp.createdAt?.seconds || Date.now() / 1000;
        const dateStr = new Date(seconds * 1000).toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
        });

        const userPaid = exp.payers
          .filter((p) => p.memberId === currentUserId)
          .reduce((sum, p) => sum + p.amountMinor, 0);
        const otherPaid = exp.payers
          .filter((p) => p.memberId === otherMemberId)
          .reduce((sum, p) => sum + p.amountMinor, 0);

        const userShare = userSplit?.amountMinor || 0;
        const otherShare = otherSplit?.amountMinor || 0;

        // Calculate direct impact between user and other member for this expense
        let impactMinor: number;
        let description: string;

        if (isUserPayer && !isOtherPayer) {
          // Current user paid the expense, other participant owes their share
          impactMinor = otherShare;
          description = `You paid • ${otherMemberName}'s share: ${formatCurrency(
            otherShare,
            exp.currency
          )}`;
        } else if (isOtherPayer && !isUserPayer) {
          // Other member paid, current user owes their share
          impactMinor = -userShare;
          description = `${otherMemberName} paid • Your share: ${formatCurrency(
            userShare,
            exp.currency
          )}`;
        } else if (isUserPayer && isOtherPayer) {
          // Multiple payers scenario
          const netContribution = (userPaid * otherShare - otherPaid * userShare) / (exp.amountMinor || 1);
          impactMinor = Math.round(netContribution);
          description = `Split payment (${formatCurrency(userPaid, exp.currency)} vs ${formatCurrency(otherPaid, exp.currency)})`;
        } else {
          // A third party paid for both
          impactMinor = 0;
          description = `Both participated in shared expense`;
        }

        list.push({
          id: exp.id,
          type: "expense",
          title: exp.title,
          date: dateStr,
          timestamp: seconds,
          groupId,
          groupName: gName,
          totalAmountMinor: exp.amountMinor,
          currency: exp.currency,
          category: exp.category,
          impactMinor,
          description,
        });
      });

      // 2. Process Settlements between currentUser and otherMember
      groupSettlements.forEach((set) => {
        if (set.status !== "active") return;

        const isUserPayer = set.payerId === currentUserId;
        const isOtherPayer = set.payerId === otherMemberId;
        const isUserReceiver = set.receiverId === currentUserId;
        const isOtherReceiver = set.receiverId === otherMemberId;

        const isDirectSettlement =
          (isUserPayer && isOtherReceiver) || (isOtherPayer && isUserReceiver);

        if (!isDirectSettlement) return;

        const seconds = set.createdAt?.seconds || Date.now() / 1000;
        const dateStr = new Date(seconds * 1000).toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
        });

        let impactMinor: number;
        let description: string;

        if (isUserPayer && isOtherReceiver) {
          // User paid money to other member (reduces what user owed or increases credit)
          impactMinor = set.amountMinor;
          description = `You paid ${otherMemberName}`;
        } else {
          // Other member paid money to user
          impactMinor = -set.amountMinor;
          description = `${otherMemberName} paid you`;
        }

        list.push({
          id: set.id,
          type: "settlement",
          title: "Direct Payment",
          date: dateStr,
          timestamp: seconds,
          groupId,
          groupName: gName,
          totalAmountMinor: set.amountMinor,
          currency: set.currency,
          impactMinor,
          description,
        });
      });
    });

    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [
    groupIds,
    groupNames,
    expensesMap,
    settlementsMap,
    currentUserId,
    otherMemberId,
    otherMemberName,
  ]);

  const isPositive = netBalanceMinor > 0;
  const isNegative = netBalanceMinor < 0;

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Shared Activity with ${otherMemberName}`}
      description="Breakdown of all expenses, splits, and repayments between you."
      className="max-w-xl"
    >
      <div className="flex flex-col gap-4 text-left">
        {/* Net Balance Status Banner */}
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
            isPositive
              ? "bg-success/10 border-success/20 text-success"
              : isNegative
              ? "bg-danger/10 border-danger/20 text-danger"
              : "bg-white/5 border-white/10 text-text-primary"
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                isPositive
                  ? "bg-success/20 text-success"
                  : isNegative
                  ? "bg-danger/20 text-danger"
                  : "bg-white/10 text-text-muted"
              }`}
            >
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider block opacity-80">
                Net Outstanding
              </span>
              <p className="text-sm sm:text-base font-extrabold truncate">
                {isPositive && `${otherMemberName} owes you`}
                {isNegative && `You owe ${otherMemberName}`}
                {!isPositive && !isNegative && "Settled Up"}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-lg sm:text-2xl font-black financial-number block">
              {isPositive && `+${formatCurrency(netBalanceMinor, currency)}`}
              {isNegative && `-${formatCurrency(Math.abs(netBalanceMinor), currency)}`}
              {!isPositive && !isNegative && formatCurrency(0, currency)}
            </span>
          </div>
        </div>

        {/* Breakdown List Header */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
            Shared Transactions ({transactions.length})
          </span>
          {groupIds.length === 1 && (
            <Link
              to={`/groups/${groupIds[0]}/settlements`}
              onClick={onClose}
              className="text-xs font-semibold text-accent-cyan hover:underline flex items-center gap-1"
            >
              <span>Record Settlement</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {/* Transactions List */}
        {transactions.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col items-center justify-center gap-2">
            <Receipt className="h-8 w-8 text-text-muted/50" />
            <p className="text-xs text-text-muted">
              No shared expenses or repayments recorded with {otherMemberName} yet.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {transactions.map((tx) => {
              const isTxPositive = tx.impactMinor > 0;
              const isTxNegative = tx.impactMinor < 0;

              return (
                <Link
                  key={`${tx.groupId}:${tx.id}`}
                  to={
                    tx.type === "expense"
                      ? `/groups/${tx.groupId}/expenses/${tx.id}`
                      : `/groups/${tx.groupId}/settlements/${tx.id}`
                  }
                  onClick={onClose}
                  className="p-3 sm:p-3.5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-accent-cyan/30 hover:bg-white/[0.06] transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        tx.type === "settlement"
                          ? "bg-accent-violet/10 text-accent-violet border border-accent-violet/20"
                          : "bg-accent-indigo/10 text-accent-indigo border border-accent-indigo/20"
                      }`}
                    >
                      {tx.type === "settlement" ? (
                        <HandCoins className="h-4 w-4" />
                      ) : (
                        <Receipt className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-text-primary group-hover:text-accent-cyan transition-colors truncate">
                        {tx.title}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-text-muted mt-0.5 flex-wrap">
                        <span>{tx.date}</span>
                        <span>•</span>
                        <span className="truncate max-w-[120px]">{tx.groupName}</span>
                        <span>•</span>
                        <span className="text-text-secondary truncate">{tx.description}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex items-center gap-2">
                    <div>
                      {tx.impactMinor !== 0 ? (
                        <span
                          className={`text-xs sm:text-sm font-bold financial-number block ${
                            isTxPositive
                              ? "text-success"
                              : isTxNegative
                              ? "text-danger"
                              : "text-text-primary"
                          }`}
                        >
                          {isTxPositive && `+${formatCurrency(tx.impactMinor, tx.currency)}`}
                          {isTxNegative && `-${formatCurrency(Math.abs(tx.impactMinor), tx.currency)}`}
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-text-muted block">
                          Balanced
                        </span>
                      )}
                      <span className="text-[9px] text-text-muted block mt-0.5">
                        Total {formatCurrency(tx.totalAmountMinor, tx.currency)}
                      </span>
                    </div>

                    <ChevronRight className="h-3.5 w-3.5 text-text-muted group-hover:text-text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Dialog>
  );
};
export default SharedExpensesModal;
