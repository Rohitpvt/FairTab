import React, { useState, useMemo, useCallback } from "react";
import {
  BookOpen,
  Receipt,
  Handshake,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Search,
  Coins,
  ArrowRight,
} from "lucide-react";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { formatCurrency, formatTimestamp } from "../../utils/format";
import {
  calculateBalances,
  simplifyPreserveRelationships,
  simplifyMinimumTransactions,
} from "@fairtab/domain";
import type { ExpenseDocument, SettlementDocument } from "@fairtab/domain";
import type { GroupDocument } from "../groups/groupSchema";
import type { GroupMemberDocument } from "../groups/memberSchema";

interface HistoricalLedgerAndBalanceSectionProps {
  group: GroupDocument | null;
  members: GroupMemberDocument[];
  expenses: ExpenseDocument[];
  settlements: SettlementDocument[];
  resolveName: (member: GroupMemberDocument) => string;
}

type TabType = "balance_summary" | "expense_ledger" | "settlement_ledger";

export const HistoricalLedgerAndBalanceSection: React.FC<HistoricalLedgerAndBalanceSectionProps> = ({
  group,
  members,
  expenses,
  settlements,
  resolveName,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("balance_summary");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "voided">("all");

  const currency = group?.baseCurrency || "INR";
  const activeMembers = useMemo(() => members.filter((m) => m.status === "active"), [members]);
  const activeMemberIds = useMemo(() => activeMembers.map((m) => m.id), [activeMembers]);
  const activeExpenses = useMemo(() => expenses.filter((e) => e.status !== "voided"), [expenses]);

  // 1. Calculate Balances & Member Contribution Metrics
  const { memberStats, totalGroupVolume, totalSettledVolume } = useMemo(() => {
    const balances = calculateBalances(activeExpenses, settlements, activeMemberIds);

    // Member Contribution Aggregations
    const paidByMember: Record<string, number> = {};
    const shareByMember: Record<string, number> = {};

    activeMemberIds.forEach((id) => {
      paidByMember[id] = 0;
      shareByMember[id] = 0;
    });

    let groupVol = 0;
    activeExpenses.forEach((exp) => {
      groupVol += exp.amountMinor;
      exp.payers.forEach((p) => {
        paidByMember[p.memberId] = (paidByMember[p.memberId] || 0) + p.amountMinor;
      });
      exp.splits.forEach((s) => {
        shareByMember[s.memberId] = (shareByMember[s.memberId] || 0) + s.amountMinor;
      });
    });

    let settledVol = 0;
    settlements.forEach((s) => {
      if (s.status === "active") {
        settledVol += s.amountMinor;
      }
    });

    const strategy = group?.settlementStrategy || "preserve_relationships";
    const recs =
      strategy === "minimum_transactions"
        ? simplifyMinimumTransactions(balances)
        : simplifyPreserveRelationships(activeExpenses, settlements, activeMemberIds);

    const stats = activeMembers.map((m) => {
      const name = resolveName(m);
      const balObj = balances.find((b) => b.memberId === m.id);
      const netBalance = balObj ? balObj.netBaseMinor : 0;
      const totalPaid = paidByMember[m.id] || 0;
      const totalShare = shareByMember[m.id] || 0;

      // Calculate debts owed to and by this member
      const debtsOwedToThisMember = recs.filter((r) => r.toMemberId === m.id);
      const debtsThisMemberOwes = recs.filter((r) => r.fromMemberId === m.id);

      return {
        member: m,
        displayName: name,
        netBalance,
        totalPaid,
        totalShare,
        debtsOwedToThisMember,
        debtsThisMemberOwes,
      };
    });

    // Sort stats by highest net balance descending
    stats.sort((a, b) => b.netBalance - a.netBalance);

    return {
      memberStats: stats,
      totalGroupVolume: groupVol,
      totalSettledVolume: settledVol,
    };
  }, [activeExpenses, settlements, activeMemberIds, activeMembers, group, resolveName]);

  // Name resolver helper for IDs
  const getMemberDisplayName = useCallback((memberId: string) => {
    const found = members.find((m) => m.id === memberId || m.userId === memberId);
    return found ? resolveName(found) : "Member";
  }, [members, resolveName]);

  // 2. Filtered Expenses Ledger
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const matchesSearch =
        searchQuery === "" ||
        exp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exp.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exp.payers.some((p) => getMemberDisplayName(p.memberId).toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && exp.status !== "voided") ||
        (statusFilter === "voided" && exp.status === "voided");

      return matchesSearch && matchesStatus;
    });
  }, [expenses, searchQuery, statusFilter, getMemberDisplayName]);

  // 3. Filtered Settlements Ledger
  const filteredSettlements = useMemo(() => {
    return settlements.filter((set) => {
      const payerName = getMemberDisplayName(set.payerId);
      const receiverName = getMemberDisplayName(set.receiverId);
      const matchesSearch =
        searchQuery === "" ||
        payerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        receiverName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && set.status === "active") ||
        (statusFilter === "voided" && set.status === "voided");

      return matchesSearch && matchesStatus;
    });
  }, [settlements, searchQuery, statusFilter, getMemberDisplayName]);

  return (
    <div className="flex flex-col gap-6 mt-4">
      {/* Top Header & Tab Navigation */}
      <GlassPanel variant="standard" className="p-5 flex flex-col gap-5 text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-indigo/15 border border-accent-indigo/30 flex items-center justify-center text-accent-cyan">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-primary tracking-tight">
                Ledger Records & Balance History
              </h3>
              <p className="text-xs text-text-muted">
                Audit complete transaction ledgers, member balance summaries, and settlement history.
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3">
            <div className="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 flex flex-col">
              <span className="text-[10px] font-bold text-text-muted uppercase">Total Expenses</span>
              <span className="text-sm font-extrabold text-text-primary financial-number">
                {formatCurrency(totalGroupVolume, currency)}
              </span>
            </div>
            <div className="px-3.5 py-1.5 rounded-xl bg-success/10 border border-success/20 flex flex-col">
              <span className="text-[10px] font-bold text-success uppercase">Total Settled</span>
              <span className="text-sm font-extrabold text-success financial-number">
                {formatCurrency(totalSettledVolume, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Buttons & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border-color/60 pt-4">
          <div className="overflow-x-auto no-scrollbar w-full sm:w-auto pb-1">
            <div className="inline-flex items-center gap-1.5 bg-black/10 dark:bg-black/30 p-1 rounded-xl border border-border-color/80 min-w-max">
              <button
                type="button"
                onClick={() => setActiveTab("balance_summary")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === "balance_summary"
                    ? "bg-accent-indigo text-white shadow-lg shadow-accent-indigo/20"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <Coins className="h-3.5 w-3.5" />
                Balance Summary
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("expense_ledger")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === "expense_ledger"
                    ? "bg-accent-indigo text-white shadow-lg shadow-accent-indigo/20"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <Receipt className="h-3.5 w-3.5" />
                Expenses Ledger ({expenses.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("settlement_ledger")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === "settlement_ledger"
                    ? "bg-accent-indigo text-white shadow-lg shadow-accent-indigo/20"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <Handshake className="h-3.5 w-3.5" />
                Settlements ({settlements.length})
              </button>
            </div>
          </div>

          {/* Search Bar & Status Filter for Ledgers */}
          {activeTab !== "balance_summary" && (
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search ledger..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-auto bg-surface-secondary/70 border border-border-color rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "voided")}
                className="bg-surface-secondary/70 border border-border-color rounded-lg px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent-cyan"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="voided">Voided</option>
              </select>
            </div>
          )}
        </div>
      </GlassPanel>

      {/* Tab 1: Member Balance Summary Records */}
      {activeTab === "balance_summary" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {memberStats.map((stat) => {
              const isPositive = stat.netBalance > 0;
              const isNegative = stat.netBalance < 0;
              const isSettled = stat.netBalance === 0;

              return (
                <GlassPanel
                  key={stat.member.id}
                  variant="standard"
                  className="p-5 flex flex-col justify-between gap-4 text-left border border-white/5 hover:border-white/15 transition-all"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-bold text-xs text-text-primary">
                          {stat.displayName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-text-primary leading-tight">
                            {stat.displayName}
                          </h4>
                          <span className="text-[10px] text-text-muted uppercase font-semibold">
                            {stat.member.role}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-xs font-extrabold px-2.5 py-1 rounded-lg flex items-center gap-1 ${
                          isPositive
                            ? "bg-success/15 text-success border border-success/20"
                            : isNegative
                            ? "bg-danger/15 text-danger border border-danger/20"
                            : "bg-white/5 text-text-muted border border-white/10"
                        }`}
                      >
                        {isPositive ? (
                          <>
                            <ArrowUpRight className="h-3 w-3" />
                            +{formatCurrency(stat.netBalance, currency)}
                          </>
                        ) : isNegative ? (
                          <>
                            <ArrowDownLeft className="h-3 w-3" />
                            -{formatCurrency(Math.abs(stat.netBalance), currency)}
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            Settled
                          </>
                        )}
                      </span>
                    </div>

                    {/* Paid vs Share Stats */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-semibold text-text-muted uppercase">Total Paid</span>
                        <span className="text-xs font-bold text-text-secondary financial-number">
                          {formatCurrency(stat.totalPaid, currency)}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-semibold text-text-muted uppercase">Total Share</span>
                        <span className="text-xs font-bold text-text-secondary financial-number">
                          {formatCurrency(stat.totalShare, currency)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Direct Relationship Debts */}
                  <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5 text-[11px]">
                    {stat.debtsOwedToThisMember.length > 0 && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-success uppercase">Owed By:</span>
                        {stat.debtsOwedToThisMember.map((d) => (
                          <div
                            key={d.fromMemberId}
                            className="flex items-center justify-between text-text-secondary bg-white/[0.02] px-2 py-1 rounded"
                          >
                            <span>{getMemberDisplayName(d.fromMemberId)}</span>
                            <span className="font-bold text-success financial-number">
                              +{formatCurrency(d.amountMinor, currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {stat.debtsThisMemberOwes.length > 0 && (
                      <div className="flex flex-col gap-1 mt-1">
                        <span className="text-[10px] font-bold text-danger uppercase">Owes To:</span>
                        {stat.debtsThisMemberOwes.map((d) => (
                          <div
                            key={d.toMemberId}
                            className="flex items-center justify-between text-text-secondary bg-white/[0.02] px-2 py-1 rounded"
                          >
                            <span>{getMemberDisplayName(d.toMemberId)}</span>
                            <span className="font-bold text-danger financial-number">
                              -{formatCurrency(d.amountMinor, currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {isSettled && (
                      <span className="text-text-muted text-[11px] italic">
                        No outstanding balance or debts.
                      </span>
                    )}
                  </div>
                </GlassPanel>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Expense Ledger */}
      {activeTab === "expense_ledger" && (
        <GlassPanel variant="standard" className="p-0 overflow-hidden text-left border border-border-color">
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[580px] text-xs text-left">
              <thead className="bg-surface-secondary/70 border-b border-border-color text-text-muted uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Expense Title</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Paid By</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Split Summary</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color/60 text-text-primary">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-text-muted">
                      No expense records found matching the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((exp) => {
                    const payerNames = exp.payers.map((p) => getMemberDisplayName(p.memberId)).join(", ");
                    const isVoided = exp.status === "voided";

                    return (
                      <tr
                        key={exp.id}
                        className={`hover:bg-surface-hover/50 transition-colors ${
                          isVoided ? "opacity-50 line-through" : ""
                        }`}
                      >
                        <td className="py-3 px-4 text-text-muted whitespace-nowrap">
                          {formatTimestamp(exp.createdAt)}
                        </td>
                        <td className="py-3 px-4 font-bold text-text-primary max-w-[200px] truncate">
                          {exp.title}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full bg-accent-indigo/15 text-accent-indigo dark:text-accent-cyan border border-accent-indigo/20 text-[10px] font-semibold uppercase">
                            {exp.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-text-secondary font-medium">
                          {payerNames || "Unknown"}
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-text-primary financial-number whitespace-nowrap">
                          {formatCurrency(exp.amountMinor, exp.currency || currency)}
                        </td>
                        <td className="py-3 px-4 text-text-muted text-[11px]">
                          {exp.splits.length} member{exp.splits.length !== 1 ? "s" : ""} ({exp.splitMethod})
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              isVoided
                                ? "bg-danger/10 text-danger border border-danger/20"
                                : "bg-success/10 text-success border border-success/20"
                            }`}
                          >
                            {exp.status || "active"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </GlassPanel>
      )}

      {/* Tab 3: Settlements Ledger */}
      {activeTab === "settlement_ledger" && (
        <GlassPanel variant="standard" className="p-0 overflow-hidden text-left border border-border-color">
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[520px] text-xs text-left">
              <thead className="bg-surface-secondary/70 border-b border-border-color text-text-muted uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Payer</th>
                  <th className="py-3 px-4 text-center">Transfer</th>
                  <th className="py-3 px-4">Receiver</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color/60 text-text-primary">
                {filteredSettlements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-text-muted">
                      No settlement records found matching the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredSettlements.map((set) => {
                    const payerName = getMemberDisplayName(set.payerId);
                    const receiverName = getMemberDisplayName(set.receiverId);
                    const isVoided = set.status === "voided";

                    return (
                      <tr
                        key={set.id}
                        className={`hover:bg-surface-hover/50 transition-colors ${
                          isVoided ? "opacity-50 line-through" : ""
                        }`}
                      >
                        <td className="py-3 px-4 text-text-muted whitespace-nowrap">
                          {formatTimestamp(set.createdAt)}
                        </td>
                        <td className="py-3 px-4 font-semibold text-text-primary">
                          {payerName}
                        </td>
                        <td className="py-3 px-4 text-center text-accent-indigo dark:text-accent-cyan">
                          <ArrowRight className="h-4 w-4 mx-auto" />
                        </td>
                        <td className="py-3 px-4 font-semibold text-text-primary">
                          {receiverName}
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-success financial-number whitespace-nowrap">
                          {formatCurrency(set.amountMinor, set.currency || currency)}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              isVoided
                                ? "bg-danger/10 text-danger border border-danger/20"
                                : "bg-success/10 text-success border border-success/20"
                            }`}
                          >
                            {set.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </GlassPanel>
      )}
    </div>
  );
};
