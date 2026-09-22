import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, ArrowDownLeft, CheckCircle2, ChevronRight, User, Eye } from "lucide-react";
import { GlassPanel } from "../ui/GlassPanel";
import { formatCurrency } from "../../utils/format";
import { SharedExpensesModal } from "./SharedExpensesModal";
import type { ExpenseDocument, SettlementDocument } from "@fairtab/domain";

export interface IndividualDebtBreakdown {
  id: string; // unique key
  groupId: string;
  groupName: string;
  otherMemberId: string;
  otherMemberName: string;
  amountMinor: number; // positive = other owes user, negative = user owes other
  currency: string;
  type: "owed_to_user" | "user_owes";
}

interface PersonalDebtSummaryCardProps {
  totalNetMinor: number;
  totalOwedMinor: number;
  totalOwesMinor: number;
  currency: string;
  breakdowns: IndividualDebtBreakdown[];
  className?: string;
  isGroupContext?: boolean;
  expensesMap?: Record<string, ExpenseDocument[]>;
  settlementsMap?: Record<string, SettlementDocument[]>;
  currentUserId?: string;
}

export const PersonalDebtSummaryCard: React.FC<PersonalDebtSummaryCardProps> = ({
  totalNetMinor,
  totalOwedMinor,
  totalOwesMinor,
  currency,
  breakdowns,
  className = "",
  isGroupContext = false,
  expensesMap = {},
  settlementsMap = {},
  currentUserId = "",
}) => {
  const navigate = useNavigate();

  // Modal state for drilling into person's transactions
  const [selectedPerson, setSelectedPerson] = useState<{
    otherMemberName: string;
    otherMemberId: string;
    netBalanceMinor: number;
    currency: string;
    groupIds: string[];
    groupNames: Record<string, string>;
  } | null>(null);

  // Aggregate multi-group breakdowns by person when not in a single group context
  const aggregatedPeopleWhoOweYou = React.useMemo(() => {
    const rawList = breakdowns.filter((b) => b.type === "owed_to_user" && b.amountMinor > 0);
    if (isGroupContext) {
      return rawList
        .map((item) => ({ ...item, totalAmountMinor: item.amountMinor, groupItems: [item] }))
        .sort((a, b) => b.totalAmountMinor - a.totalAmountMinor);
    }

    const personMap = new Map<string, {
      id: string;
      otherMemberId: string;
      otherMemberName: string;
      totalAmountMinor: number;
      currency: string;
      groupItems: IndividualDebtBreakdown[];
    }>();

    rawList.forEach((item) => {
      const nameKey = (item.otherMemberName || item.otherMemberId).trim().toLowerCase();
      const existing = personMap.get(nameKey);
      if (existing) {
        existing.totalAmountMinor += item.amountMinor;
        existing.groupItems.push(item);
      } else {
        personMap.set(nameKey, {
          id: item.id,
          otherMemberId: item.otherMemberId,
          otherMemberName: item.otherMemberName,
          totalAmountMinor: item.amountMinor,
          currency: item.currency,
          groupItems: [item],
        });
      }
    });

    const result = Array.from(personMap.values());
    // Sort descending by highest total amount owed to user
    result.sort((a, b) => b.totalAmountMinor - a.totalAmountMinor);
    // Sort sub-group breakdowns descending by amount
    result.forEach((person) => {
      person.groupItems.sort((a, b) => b.amountMinor - a.amountMinor);
    });
    return result;
  }, [breakdowns, isGroupContext]);

  const aggregatedPeopleYouOwe = React.useMemo(() => {
    const rawList = breakdowns.filter((b) => b.type === "user_owes" && b.amountMinor > 0);
    if (isGroupContext) {
      return rawList
        .map((item) => ({ ...item, totalAmountMinor: item.amountMinor, groupItems: [item] }))
        .sort((a, b) => b.totalAmountMinor - a.totalAmountMinor);
    }

    const personMap = new Map<string, {
      id: string;
      otherMemberId: string;
      otherMemberName: string;
      totalAmountMinor: number;
      currency: string;
      groupItems: IndividualDebtBreakdown[];
    }>();

    rawList.forEach((item) => {
      const nameKey = (item.otherMemberName || item.otherMemberId).trim().toLowerCase();
      const existing = personMap.get(nameKey);
      if (existing) {
        existing.totalAmountMinor += item.amountMinor;
        existing.groupItems.push(item);
      } else {
        personMap.set(nameKey, {
          id: item.id,
          otherMemberId: item.otherMemberId,
          otherMemberName: item.otherMemberName,
          totalAmountMinor: item.amountMinor,
          currency: item.currency,
          groupItems: [item],
        });
      }
    });

    const result = Array.from(personMap.values());
    // Sort descending by highest total amount user owes
    result.sort((a, b) => b.totalAmountMinor - a.totalAmountMinor);
    // Sort sub-group breakdowns descending by amount
    result.forEach((person) => {
      person.groupItems.sort((a, b) => b.amountMinor - a.amountMinor);
    });
    return result;
  }, [breakdowns, isGroupContext]);

  const openBreakdown = (
    otherMemberName: string,
    otherMemberId: string,
    netBalanceMinor: number,
    itemCurrency: string,
    groupItems: IndividualDebtBreakdown[]
  ) => {
    const groupIds = Array.from(new Set(groupItems.map((gi) => gi.groupId)));
    const groupNames: Record<string, string> = {};
    groupItems.forEach((gi) => {
      groupNames[gi.groupId] = gi.groupName;
    });

    setSelectedPerson({
      otherMemberName,
      otherMemberId,
      netBalanceMinor,
      currency: itemCurrency,
      groupIds,
      groupNames,
    });
  };

  /**
   * Navigate to the settlement recording page for a given group and member.
   */
  const handleNavigateToSettlement = (
    itemType: "owed_to_user" | "user_owes",
    otherMemberId: string,
    amountMinor: number,
    groupItems: IndividualDebtBreakdown[]
  ) => {
    // Determine the primary group to navigate to
    const primaryGroup = groupItems[0];
    if (!primaryGroup) return;

    const fromId = itemType === "owed_to_user" ? otherMemberId : (currentUserId || "");
    const toId = itemType === "owed_to_user" ? (currentUserId || "") : otherMemberId;
    const amountVal = (amountMinor / 100).toFixed(2);

    navigate(
      `/groups/${primaryGroup.groupId}/settlements/new?from=${encodeURIComponent(
        fromId
      )}&to=${encodeURIComponent(toId)}&amount=${encodeURIComponent(amountVal)}`
    );
  };

  const isNetPositive = totalNetMinor > 0;
  const isNetNegative = totalNetMinor < 0;
  const isAllSettled = totalNetMinor === 0 && totalOwedMinor === 0 && totalOwesMinor === 0;

  return (
    <>
      <GlassPanel
        variant="standard"
        className={`p-5 sm:p-7 rounded-2xl sm:rounded-3xl border border-border-color bg-surface-primary/95 shadow-xl relative overflow-hidden text-left ${className}`}
      >
        {/* Background ambient lighting */}
        <div
          className={`absolute -right-16 -top-16 w-56 h-56 rounded-full blur-3xl pointer-events-none opacity-15 ${
            isNetPositive ? "bg-success" : isNetNegative ? "bg-danger" : "bg-[#E2C854]"
          }`}
        />

        {/* Main High-Level Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-color pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase font-bold tracking-wider text-[#E2C854] bg-[#E2C854]/10 border border-[#E2C854]/25 px-2.5 py-0.5 rounded-full">
                {isGroupContext ? "Group Balance" : "Net Financial Position"}
              </span>
              {isAllSettled && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="h-3 w-3" /> Settled Up
                </span>
              )}
            </div>

            <div className="mt-2.5 flex items-baseline gap-2">
              <h2
                className={`text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight ${
                  isNetPositive
                    ? "text-success"
                    : isNetNegative
                      ? "text-danger"
                      : "text-text-primary"
                }`}
              >
                {isNetPositive && `You are owed ${formatCurrency(totalNetMinor, currency)} overall`}
                {isNetNegative && `You owe ${formatCurrency(Math.abs(totalNetMinor), currency)} overall`}
                {isAllSettled && "You are all settled up with everyone"}
              </h2>
            </div>
          </div>

          {/* Quick pill stats */}
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            {totalOwedMinor > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-success/10 border border-success/20 text-success text-xs font-bold financial-number">
                <ArrowUpRight className="h-4 w-4 shrink-0" />
                <span>+{formatCurrency(totalOwedMinor, currency)}</span>
              </div>
            )}
            {totalOwesMinor > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-bold financial-number">
                <ArrowDownLeft className="h-4 w-4 shrink-0" />
                <span>-{formatCurrency(totalOwesMinor, currency)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Breakdown By Person */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Left Column: People who owe YOU */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-success flex items-center gap-1.5">
                <ArrowUpRight className="h-3.5 w-3.5" />
                Owed to you ({aggregatedPeopleWhoOweYou.length})
              </span>
            </div>

            {aggregatedPeopleWhoOweYou.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-text-muted">
                No one owes you right now.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {aggregatedPeopleWhoOweYou.map((item) => {
                  const displayName = item.otherMemberName || item.otherMemberId || "Member";
                  const initials = displayName.slice(0, 2).toUpperCase();
                  return (
                    <div
                      key={item.id}
                      onClick={() =>
                        handleNavigateToSettlement(
                          "owed_to_user",
                          item.otherMemberId,
                          item.totalAmountMinor,
                          item.groupItems
                        )
                      }
                      className="p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-success/40 hover:bg-white/[0.06] cursor-pointer transition-all flex flex-col gap-2 group"
                      title={`Click to settle with ${displayName}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-success/10 border border-success/20 flex items-center justify-center text-success font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
                            {initials || <User className="h-3.5 w-3.5" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-semibold text-text-primary truncate">
                              <span className="text-success font-bold">{displayName}</span> owes you
                            </p>
                            {!isGroupContext && (
                              <p className="text-[10px] text-text-muted truncate mt-0.5">
                                {item.groupItems.length > 1
                                  ? `across ${item.groupItems.length} groups`
                                  : `in ${item.groupItems[0]?.groupName || "group"}`}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0 flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-extrabold text-success financial-number">
                            +{formatCurrency(item.totalAmountMinor, item.currency)}
                          </span>
                          {/* Dedicated Eye Button for Summary Modal */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openBreakdown(
                                displayName,
                                item.otherMemberId,
                                item.totalAmountMinor,
                                item.currency,
                                item.groupItems
                              );
                            }}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-success/20 text-text-muted hover:text-success border border-white/5 hover:border-success/30 transition-all flex items-center gap-1 text-[10px] font-medium cursor-pointer"
                            title={`View shared expense summary with ${displayName}`}
                            aria-label={`View shared expenses with ${displayName}`}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Details</span>
                          </button>
                        </div>
                      </div>

                      {/* If across multiple groups, list each group's balance */}
                      {!isGroupContext && item.groupItems.length > 1 && (
                        <div className="pl-10.5 pt-1.5 border-t border-white/5 flex flex-col gap-1.5 text-[11px]">
                          {item.groupItems.map((gi) => (
                            <div
                              key={gi.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNavigateToSettlement(
                                  "owed_to_user",
                                  gi.otherMemberId,
                                  gi.amountMinor,
                                  [gi]
                                );
                              }}
                              className="flex justify-between items-center text-text-muted hover:text-text-secondary group/row cursor-pointer"
                            >
                              <span className="hover:underline hover:text-accent-cyan truncate max-w-[160px]">
                                {gi.groupName}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-success financial-number">
                                  +{formatCurrency(gi.amountMinor, gi.currency)}
                                </span>
                                <ChevronRight className="h-3 w-3 opacity-60 group-hover/row:opacity-100" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: People YOU owe */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-danger flex items-center gap-1.5">
                <ArrowDownLeft className="h-3.5 w-3.5" />
                You owe ({aggregatedPeopleYouOwe.length})
              </span>
            </div>

            {aggregatedPeopleYouOwe.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-text-muted">
                You don&apos;t owe anyone right now.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {aggregatedPeopleYouOwe.map((item) => {
                  const displayName = item.otherMemberName || item.otherMemberId || "Member";
                  const initials = displayName.slice(0, 2).toUpperCase();
                  return (
                    <div
                      key={item.id}
                      onClick={() =>
                        handleNavigateToSettlement(
                          "user_owes",
                          item.otherMemberId,
                          item.totalAmountMinor,
                          item.groupItems
                        )
                      }
                      className="p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-danger/40 hover:bg-white/[0.06] cursor-pointer transition-all flex flex-col gap-2 group"
                      title={`Click to settle with ${displayName}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-danger/10 border border-danger/20 flex items-center justify-center text-danger font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
                            {initials || <User className="h-3.5 w-3.5" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-semibold text-text-primary truncate">
                              You owe <span className="text-danger font-bold">{displayName}</span>
                            </p>
                            {!isGroupContext && (
                              <p className="text-[10px] text-text-muted truncate mt-0.5">
                                {item.groupItems.length > 1
                                  ? `across ${item.groupItems.length} groups`
                                  : `in ${item.groupItems[0]?.groupName || "group"}`}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0 flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-extrabold text-danger financial-number">
                            -{formatCurrency(item.totalAmountMinor, item.currency)}
                          </span>
                          {/* Dedicated Eye Button for Summary Modal */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openBreakdown(
                                displayName,
                                item.otherMemberId,
                                -item.totalAmountMinor,
                                item.currency,
                                item.groupItems
                              );
                            }}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-danger/20 text-text-muted hover:text-danger border border-white/5 hover:border-danger/30 transition-all flex items-center gap-1 text-[10px] font-medium cursor-pointer"
                            title={`View shared expense summary with ${displayName}`}
                            aria-label={`View shared expenses with ${displayName}`}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Details</span>
                          </button>
                        </div>
                      </div>

                      {/* If across multiple groups, list each group's balance */}
                      {!isGroupContext && item.groupItems.length > 1 && (
                        <div className="pl-10.5 pt-1.5 border-t border-white/5 flex flex-col gap-1.5 text-[11px]">
                          {item.groupItems.map((gi) => (
                            <div
                              key={gi.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNavigateToSettlement(
                                  "user_owes",
                                  gi.otherMemberId,
                                  gi.amountMinor,
                                  [gi]
                                );
                              }}
                              className="flex justify-between items-center text-text-muted hover:text-text-secondary group/row cursor-pointer"
                            >
                              <span className="hover:underline hover:text-accent-cyan truncate max-w-[160px]">
                                {gi.groupName}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-danger financial-number">
                                  -{formatCurrency(gi.amountMinor, gi.currency)}
                                </span>
                                <ChevronRight className="h-3 w-3 opacity-60 group-hover/row:opacity-100" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </GlassPanel>

      {/* Shared Expenses & Repayments Details Modal */}
      {selectedPerson && (
        <SharedExpensesModal
          isOpen={!!selectedPerson}
          onClose={() => setSelectedPerson(null)}
          otherMemberName={selectedPerson.otherMemberName}
          otherMemberId={selectedPerson.otherMemberId}
          netBalanceMinor={selectedPerson.netBalanceMinor}
          currency={selectedPerson.currency}
          groupIds={selectedPerson.groupIds}
          groupNames={selectedPerson.groupNames}
          expensesMap={expensesMap}
          settlementsMap={settlementsMap}
          currentUserId={currentUserId}
        />
      )}
    </>
  );
};

export default PersonalDebtSummaryCard;
