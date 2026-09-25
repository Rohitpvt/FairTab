import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Receipt,
  HandCoins,
  ArrowRight,
  User,
  CloudOff,
  Scale,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  UserMinus,
} from "lucide-react";
import { Dialog } from "../ui/Dialogs";
import { Button } from "../ui/Button";
import { formatCurrency } from "../../utils/format";
import {
  calculateBalances,
  simplifyPreserveRelationships,
  simplifyMinimumTransactions,
} from "@fairtab/domain";
import type { ExpenseDocument, SettlementDocument } from "@fairtab/domain";
import type { GroupMemberDocument } from "../../features/groups/memberSchema";
import { useMemberNameResolver } from "../../hooks/useMemberNameResolver";
import { canChangeRole, canRemoveMember } from "../../features/groups/permissions";

interface MemberLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  currency: string;
  member: GroupMemberDocument | null;
  allMembers: GroupMemberDocument[];
  expenses: ExpenseDocument[];
  settlements: SettlementDocument[];
  settlementStrategy?: "minimum_transactions" | "preserve_relationships";
  currentUserRole?: "owner" | "admin" | "member" | "viewer";
  currentUserUid?: string;
  onRoleChange?: (member: GroupMemberDocument, newRole: "admin" | "member" | "viewer") => void;
  onRemoveMember?: (member: GroupMemberDocument) => void;
}

export const MemberLedgerModal: React.FC<MemberLedgerModalProps> = ({
  isOpen,
  onClose,
  groupId,
  groupName,
  currency,
  member,
  allMembers,
  expenses,
  settlements,
  settlementStrategy = "preserve_relationships",
  currentUserRole = "member",
  currentUserUid,
  onRoleChange,
  onRemoveMember,
}) => {
  const { resolveName } = useMemberNameResolver(allMembers);
  const [filterTab, setFilterTab] = useState<"all" | "expenses" | "settlements">("all");

  const memberId = member?.id || "";
  const memberName = member ? resolveName(member) : "Member";
  const isPlaceholder = member?.kind === "placeholder";
  const isFormer = member?.status === "removed" || member?.status === "left";
  const canRecordSettlement = currentUserRole === "owner" || currentUserRole === "admin" || !isPlaceholder;

  // 1. Calculate overall balances
  const allMemberIds = useMemo(() => {
    return Array.from(
      new Set([
        ...allMembers.map((m) => m.id),
        ...expenses.flatMap((e) => [
          ...e.payers.map((p) => p.memberId),
          ...e.splits.map((s) => s.memberId),
        ]),
        ...settlements.flatMap((s) => [s.payerId, s.receiverId]),
      ])
    );
  }, [allMembers, expenses, settlements]);

  const activeExpenses = useMemo(() => expenses.filter((e) => e.status !== "voided"), [expenses]);
  const activeSettlements = useMemo(() => settlements.filter((s) => s.status === "active"), [settlements]);

  const calculatedBalances = useMemo(() => {
    return calculateBalances(activeExpenses, activeSettlements, allMemberIds);
  }, [activeExpenses, activeSettlements, allMemberIds]);

  const memberBalanceObj = useMemo(() => {
    return calculatedBalances.find((b) => b.memberId === memberId || (member?.userId && b.memberId === member.userId));
  }, [calculatedBalances, member, memberId]);

  const netBalanceMinor = memberBalanceObj?.netBaseMinor || 0;

  // 2. Compute Debt Recommendations for this member
  const recommendations = useMemo(() => {
    const raw =
      settlementStrategy === "minimum_transactions"
        ? simplifyMinimumTransactions(calculatedBalances)
        : simplifyPreserveRelationships(activeExpenses, activeSettlements, allMemberIds);
    return raw;
  }, [settlementStrategy, calculatedBalances, activeExpenses, activeSettlements, allMemberIds]);

  // People who owe this member
  const whoOwesThisMember = useMemo(() => {
    return recommendations
      .filter((rec) => rec.toMemberId === memberId || (member?.userId && rec.toMemberId === member.userId))
      .map((rec) => {
        const otherMem = allMembers.find((m) => m.id === rec.fromMemberId || m.userId === rec.fromMemberId);
        const name = otherMem ? resolveName(otherMem) : "Former Member";
        return {
          otherId: rec.fromMemberId,
          otherName: name,
          amountMinor: rec.amountMinor,
        };
      });
  }, [recommendations, member, memberId, allMembers, resolveName]);

  // People this member owes
  const whoThisMemberOwes = useMemo(() => {
    return recommendations
      .filter((rec) => rec.fromMemberId === memberId || (member?.userId && rec.fromMemberId === member.userId))
      .map((rec) => {
        const otherMem = allMembers.find((m) => m.id === rec.toMemberId || m.userId === rec.toMemberId);
        const name = otherMem ? resolveName(otherMem) : "Former Member";
        return {
          otherId: rec.toMemberId,
          otherName: name,
          amountMinor: rec.amountMinor,
        };
      });
  }, [recommendations, member, memberId, allMembers, resolveName]);

  // 3. Compute detailed timeline of transactions involving this member
  const transactionItems = useMemo(() => {
    if (!memberId) return [];

    type TimelineItem = {
      id: string;
      type: "expense" | "settlement";
      title: string;
      date: string;
      timestamp: number;
      totalAmountMinor: number;
      currency: string;
      category?: string;
      roleDescription: string;
      impactMinor: number; // positive = added to net credit, negative = added to net debt
      linkUrl: string;
    };

    const list: TimelineItem[] = [];

    // Expenses
    expenses.forEach((exp) => {
      const isPayer = exp.payers.some((p) => p.memberId === memberId || (member?.userId && p.memberId === member.userId));
      const split = exp.splits.find((s) => s.memberId === memberId || (member?.userId && s.memberId === member.userId));
      const isSplit = !!split;

      if (!isPayer && !isSplit) return;

      const seconds = exp.incurredAt?.seconds || exp.createdAt?.seconds || 0;
      const dateStr = seconds > 0
        ? new Date(seconds * 1000).toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "Recent";

      const paidAmount = exp.payers
        .filter((p) => p.memberId === memberId || (member?.userId && p.memberId === member.userId))
        .reduce((sum, p) => sum + p.amountMinor, 0);
      const shareAmount = split?.amountMinor || 0;

      // Net impact on this member's balance: Paid upfront minus their consumed share
      const impactMinor = exp.status === "voided" ? 0 : paidAmount - shareAmount;

      let roleDescription: string;
      if (isPayer && isSplit) {
        roleDescription = `Paid ${formatCurrency(paidAmount, exp.currency)} • Share was ${formatCurrency(shareAmount, exp.currency)}`;
      } else if (isPayer) {
        roleDescription = `Paid entire ${formatCurrency(paidAmount, exp.currency)} (No personal share)`;
      } else {
        // Someone else paid
        const primaryPayer = exp.payers[0];
        const payerMem = primaryPayer
          ? allMembers.find((m) => m.id === primaryPayer.memberId || m.userId === primaryPayer.memberId)
          : null;
        const payerName = payerMem ? resolveName(payerMem) : "Group Member";
        roleDescription = `Share: ${formatCurrency(shareAmount, exp.currency)} • Paid by ${payerName}`;
      }

      if (exp.status === "voided") {
        roleDescription = `[Voided] ${roleDescription}`;
      }

      list.push({
        id: exp.id,
        type: "expense",
        title: exp.title,
        date: dateStr,
        timestamp: seconds,
        totalAmountMinor: exp.amountMinor,
        currency: exp.currency,
        category: exp.category,
        roleDescription,
        impactMinor,
        linkUrl: `/groups/${groupId}/expenses/${exp.id}`,
      });
    });

    // Settlements
    settlements.forEach((set) => {
      const isPayer = set.payerId === memberId || (member?.userId && set.payerId === member.userId);
      const isReceiver = set.receiverId === memberId || (member?.userId && set.receiverId === member.userId);

      if (!isPayer && !isReceiver) return;

      const seconds = set.createdAt?.seconds || 0;
      const dateStr = seconds > 0
        ? new Date(seconds * 1000).toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "Recent";

      const otherId = isPayer ? set.receiverId : set.payerId;
      const otherMem = allMembers.find((m) => m.id === otherId || m.userId === otherId);
      const otherName = otherMem ? resolveName(otherMem) : "Group Member";

      let roleDescription: string;
      let impactMinor: number;

      if (isPayer) {
        roleDescription = `Paid repayment of ${formatCurrency(set.amountMinor, set.currency)} to ${otherName}`;
        impactMinor = set.status === "active" ? set.amountMinor : 0; // Reduces debt / improves net balance
      } else {
        roleDescription = `Received repayment of ${formatCurrency(set.amountMinor, set.currency)} from ${otherName}`;
        impactMinor = set.status === "active" ? -set.amountMinor : 0; // Settles credit / reduces net balance
      }

      if (set.status === "voided") {
        roleDescription = `[Voided] ${roleDescription}`;
      }

      list.push({
        id: set.id,
        type: "settlement",
        title: "Settlement / Repayment",
        date: dateStr,
        timestamp: seconds,
        totalAmountMinor: set.amountMinor,
        currency: set.currency,
        roleDescription,
        impactMinor,
        linkUrl: `/groups/${groupId}/settlements/${set.id}`,
      });
    });

    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [member, memberId, expenses, settlements, allMembers, resolveName, groupId]);

  const filteredTransactions = useMemo(() => {
    if (filterTab === "expenses") return transactionItems.filter((t) => t.type === "expense");
    if (filterTab === "settlements") return transactionItems.filter((t) => t.type === "settlement");
    return transactionItems;
  }, [transactionItems, filterTab]);

  if (!member) return null;

  const isPositive = netBalanceMinor > 0;
  const isNegative = netBalanceMinor < 0;

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`Member Ledger: ${memberName}`}
      description={`Overview of expenses, debt balances, and repayments in ${groupName}.`}
      className="max-w-2xl"
    >
      <div className="flex flex-col gap-5 text-left max-h-[75vh] overflow-y-auto pr-1">
        {/* 1. Member Profile & Net Balance Hero Card */}
        <div
          className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            isPositive
              ? "bg-success/10 border-success/25 text-success"
              : isNegative
              ? "bg-danger/10 border-danger/25 text-danger"
              : "bg-white/5 border-white/10 text-text-primary"
          }`}
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-base shrink-0 ${
                isPositive
                  ? "bg-success/20 text-success"
                  : isNegative
                  ? "bg-danger/20 text-danger"
                  : "bg-white/10 text-text-muted"
              }`}
            >
              {isPlaceholder ? <CloudOff className="h-6 w-6" /> : <User className="h-6 w-6" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-base text-text-primary truncate">{memberName}</span>
                <span
                  className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${
                    isPlaceholder
                      ? "bg-accent-indigo/15 text-accent-indigo border-accent-indigo/30"
                      : "bg-white/10 text-text-muted border-white/10"
                  }`}
                >
                  {isPlaceholder ? "Offline Placeholder" : isFormer ? "Former Member" : member.role}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                {isPlaceholder
                  ? "Managed offline profile • Tracked by group admins"
                  : `Member ID: ${member.id.substring(0, 10)}...`}
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-white/5">
            <div className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
              Current Net Balance
            </div>
            <div
              className={`text-xl font-black ${
                isPositive ? "text-success" : isNegative ? "text-danger" : "text-text-muted"
              }`}
            >
              {isPositive ? "+" : ""}
              {formatCurrency(netBalanceMinor, currency)}
            </div>
            <div className="text-[10px] font-medium text-text-muted mt-0.5">
              {isPositive
                ? "Is owed money by others"
                : isNegative
                ? "Owes money in group"
                : "All balances settled"}
            </div>
          </div>
        </div>

        {/* 2. Outstanding Repayments / Debts Section */}
        <div className="bg-surface-primary/60 border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5 text-accent-cyan" />
              Direct Debts & Settle Up
            </h4>
            <span className="text-[11px] text-text-muted">
              {whoOwesThisMember.length + whoThisMemberOwes.length} active obligation(s)
            </span>
          </div>

          {whoOwesThisMember.length === 0 && whoThisMemberOwes.length === 0 ? (
            <div className="p-4 text-center rounded-xl bg-white/[0.02] border border-white/5 flex flex-col items-center gap-1.5">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <span className="text-xs text-text-secondary font-medium">
                {memberName} has zero outstanding debts in this group.
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* People who owe this member */}
              {whoOwesThisMember.map((debt) => (
                <div
                  key={`owes-to-${debt.otherId}`}
                  className="p-3 bg-success/5 border border-success/20 rounded-xl flex items-center justify-between gap-3"
                >
                  <div className="flex flex-col text-left min-w-0">
                    <span className="text-xs font-bold text-text-primary truncate">
                      {debt.otherName}
                    </span>
                    <span className="text-[11px] text-success font-semibold">
                      Owes {formatCurrency(debt.amountMinor, currency)}
                    </span>
                  </div>

                  {canRecordSettlement && (
                    <Link
                      to={`/groups/${groupId}/settlements/new?from=${debt.otherId}&to=${memberId}&amount=${(
                        debt.amountMinor / 100
                      ).toFixed(2)}`}
                      onClick={onClose}
                    >
                      <Button variant="secondary" size="sm" className="text-xs py-1 px-2.5 h-auto">
                        <HandCoins className="h-3 w-3 mr-1 text-success" />
                        <span>Settle</span>
                      </Button>
                    </Link>
                  )}
                </div>
              ))}

              {/* People this member owes */}
              {whoThisMemberOwes.map((debt) => (
                <div
                  key={`owes-from-${debt.otherId}`}
                  className="p-3 bg-danger/5 border border-danger/20 rounded-xl flex items-center justify-between gap-3"
                >
                  <div className="flex flex-col text-left min-w-0">
                    <span className="text-xs font-bold text-text-primary truncate">
                      {memberName}
                    </span>
                    <span className="text-[11px] text-danger font-semibold">
                      Owes {debt.otherName} {formatCurrency(debt.amountMinor, currency)}
                    </span>
                  </div>

                  {canRecordSettlement && (
                    <Link
                      to={`/groups/${groupId}/settlements/new?from=${memberId}&to=${debt.otherId}&amount=${(
                        debt.amountMinor / 100
                      ).toFixed(2)}`}
                      onClick={onClose}
                    >
                      <Button variant="secondary" size="sm" className="text-xs py-1 px-2.5 h-auto">
                        <HandCoins className="h-3 w-3 mr-1 text-danger" />
                        <span>Settle</span>
                      </Button>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Transaction History Feed */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap border-b border-white/5 pb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5 text-accent-cyan" />
              Activity Ledger ({filteredTransactions.length})
            </h4>

            {/* Filter Tabs */}
            <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/5 text-[11px]">
              <button
                onClick={() => setFilterTab("all")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  filterTab === "all"
                    ? "bg-accent-cyan/20 text-accent-cyan font-semibold"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterTab("expenses")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  filterTab === "expenses"
                    ? "bg-accent-cyan/20 text-accent-cyan font-semibold"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                Expenses
              </button>
              <button
                onClick={() => setFilterTab("settlements")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  filterTab === "settlements"
                    ? "bg-accent-cyan/20 text-accent-cyan font-semibold"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                Repayments
              </button>
            </div>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col items-center gap-2">
              <Receipt className="h-6 w-6 text-text-muted opacity-40" />
              <p className="text-xs text-text-muted">
                No {filterTab !== "all" ? filterTab : "transactions"} found involving {memberName}.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredTransactions.map((tx) => {
                const isImpactPositive = tx.impactMinor > 0;
                const isImpactNegative = tx.impactMinor < 0;

                return (
                  <Link
                    key={`${tx.type}-${tx.id}`}
                    to={tx.linkUrl}
                    onClick={onClose}
                    className="p-3 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-white/10 rounded-xl transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          tx.type === "expense"
                            ? "bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20"
                            : "bg-accent-indigo/10 text-accent-indigo border border-accent-indigo/20"
                        }`}
                      >
                        {tx.type === "expense" ? (
                          <Receipt className="h-4 w-4" />
                        ) : (
                          <HandCoins className="h-4 w-4" />
                        )}
                      </div>

                      <div className="min-w-0 flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-text-primary truncate group-hover:text-accent-cyan transition-colors">
                            {tx.title}
                          </span>
                          <span className="text-[10px] text-text-muted shrink-0">{tx.date}</span>
                        </div>
                        <span className="text-[11px] text-text-muted truncate mt-0.5">
                          {tx.roleDescription}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div
                          className={`text-xs font-bold flex items-center justify-end gap-0.5 ${
                            isImpactPositive
                              ? "text-success"
                              : isImpactNegative
                              ? "text-danger"
                              : "text-text-muted"
                          }`}
                        >
                          {isImpactPositive ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : isImpactNegative ? (
                            <TrendingDown className="h-3 w-3" />
                          ) : null}
                          <span>
                            {isImpactPositive ? "+" : ""}
                            {formatCurrency(tx.impactMinor, tx.currency)}
                          </span>
                        </div>
                        <div className="text-[10px] text-text-muted">
                          Total: {formatCurrency(tx.totalAmountMinor, tx.currency)}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-text-muted opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. Admin Management Section (if applicable) */}
        {!isFormer && member.id !== currentUserUid && member.userId !== currentUserUid && (
          <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text-muted">Member Role:</span>
              {member.kind === "account" && member.role !== "owner" && onRoleChange && canChangeRole(currentUserRole, member.role, "admin", false) ? (
                <select
                  value={member.role}
                  onChange={(e) => onRoleChange(member, e.target.value as "admin" | "member" | "viewer")}
                  className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-cyan transition-colors"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              ) : (
                <span className="text-xs font-medium text-text-secondary capitalize">
                  {member.kind === "placeholder" ? "Offline Placeholder" : member.role}
                </span>
              )}
            </div>

            {onRemoveMember && canRemoveMember(currentUserRole, member.role) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onClose();
                  onRemoveMember(member);
                }}
                className="text-danger hover:bg-danger/10 text-xs py-1 px-2.5 h-auto flex items-center gap-1.5 border border-transparent hover:border-danger/20"
              >
                <UserMinus className="h-3.5 w-3.5" />
                <span>Remove Member</span>
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center gap-2 pt-3 border-t border-white/10 mt-3">
        <Link to={`/groups/${groupId}/settlements`} onClick={onClose}>
          <Button variant="ghost" size="sm" className="text-xs text-accent-cyan hover:bg-accent-cyan/10">
            View All Group Settlements <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
        <Button onClick={onClose} variant="secondary" size="sm" className="text-xs">
          Close
        </Button>
      </div>
    </Dialog>
  );
};
export default MemberLedgerModal;
