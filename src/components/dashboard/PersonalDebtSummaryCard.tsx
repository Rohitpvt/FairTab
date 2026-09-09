import React from "react";
import { ArrowUpRight, ArrowDownLeft, CheckCircle2, ChevronRight, User } from "lucide-react";
import { GlassPanel } from "../ui/GlassPanel";
import { formatCurrency } from "../../utils/format";
import { Link } from "react-router-dom";

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
}

export const PersonalDebtSummaryCard: React.FC<PersonalDebtSummaryCardProps> = ({
  totalNetMinor,
  totalOwedMinor,
  totalOwesMinor,
  currency,
  breakdowns,
  className = "",
  isGroupContext = false,
}) => {
  // Aggregate multi-group breakdowns by person when not in a single group context
  const aggregatedPeopleWhoOweYou = React.useMemo(() => {
    const rawList = breakdowns.filter((b) => b.type === "owed_to_user" && b.amountMinor > 0);
    if (isGroupContext) return rawList.map((item) => ({ ...item, totalAmountMinor: item.amountMinor, groupItems: [item] }));

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

    return Array.from(personMap.values());
  }, [breakdowns, isGroupContext]);

  const aggregatedPeopleYouOwe = React.useMemo(() => {
    const rawList = breakdowns.filter((b) => b.type === "user_owes" && b.amountMinor > 0);
    if (isGroupContext) return rawList.map((item) => ({ ...item, totalAmountMinor: item.amountMinor, groupItems: [item] }));

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

    return Array.from(personMap.values());
  }, [breakdowns, isGroupContext]);

  const isNetPositive = totalNetMinor > 0;
  const isNetNegative = totalNetMinor < 0;
  const isAllSettled = totalNetMinor === 0 && totalOwedMinor === 0 && totalOwesMinor === 0;

  return (
    <GlassPanel
      variant="standard"
      className={`p-5 sm:p-6 rounded-2xl border border-white/10 shadow-lg relative overflow-hidden text-left ${className}`}
    >
      {/* Background ambient lighting */}
      <div
        className={`absolute -right-16 -top-16 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-20 ${
          isNetPositive ? "bg-success" : isNetNegative ? "bg-danger" : "bg-accent-cyan"
        }`}
      />

      {/* Main High-Level Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold tracking-wider text-text-muted">
              {isGroupContext ? "Your Group Balance Summary" : "Your Overall Balance Summary"}
            </span>
            {isAllSettled && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="h-3 w-3" /> Settled Up
              </span>
            )}
          </div>

          <div className="mt-1.5 flex items-baseline gap-2">
            <h2
              className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
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
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-success/10 border border-success/20 text-success text-xs font-bold">
              <ArrowUpRight className="h-4 w-4 shrink-0" />
              <span>+{formatCurrency(totalOwedMinor, currency)}</span>
            </div>
          )}
          {totalOwesMinor > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-bold">
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
                    className="p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-success/30 hover:bg-white/[0.05] transition-all flex flex-col gap-2 group"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-success/10 border border-success/20 flex items-center justify-center text-success font-bold text-xs shrink-0">
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
                        {!isGroupContext && item.groupItems.length === 1 && (
                          <Link
                            to={`/groups/${item.groupItems[0].groupId}/settlements`}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10 text-text-muted hover:text-text-primary"
                            title="View Settlements"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* If across multiple groups, list each group's balance */}
                    {!isGroupContext && item.groupItems.length > 1 && (
                      <div className="pl-10.5 pt-1.5 border-t border-white/5 flex flex-col gap-1.5 text-[11px]">
                        {item.groupItems.map((gi) => (
                          <div key={gi.id} className="flex justify-between items-center text-text-muted hover:text-text-secondary group/row">
                            <Link to={`/groups/${gi.groupId}`} className="hover:underline hover:text-accent-cyan truncate max-w-[160px]">
                              {gi.groupName}
                            </Link>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-success financial-number">
                                +{formatCurrency(gi.amountMinor, gi.currency)}
                              </span>
                              <Link
                                to={`/groups/${gi.groupId}/settlements`}
                                className="p-0.5 rounded hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors"
                                title={`View Settlements in ${gi.groupName}`}
                              >
                                <ChevronRight className="h-3 w-3" />
                              </Link>
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
                    className="p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-danger/30 hover:bg-white/[0.05] transition-all flex flex-col gap-2 group"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-danger/10 border border-danger/20 flex items-center justify-center text-danger font-bold text-xs shrink-0">
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
                        {!isGroupContext && item.groupItems.length === 1 && (
                          <Link
                            to={`/groups/${item.groupItems[0].groupId}/settlements`}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10 text-text-muted hover:text-text-primary"
                            title="Settle Up"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* If across multiple groups, list each group's balance */}
                    {!isGroupContext && item.groupItems.length > 1 && (
                      <div className="pl-10.5 pt-1.5 border-t border-white/5 flex flex-col gap-1.5 text-[11px]">
                        {item.groupItems.map((gi) => (
                          <div key={gi.id} className="flex justify-between items-center text-text-muted hover:text-text-secondary group/row">
                            <Link to={`/groups/${gi.groupId}`} className="hover:underline hover:text-accent-cyan truncate max-w-[160px]">
                              {gi.groupName}
                            </Link>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-danger financial-number">
                                -{formatCurrency(gi.amountMinor, gi.currency)}
                              </span>
                              <Link
                                to={`/groups/${gi.groupId}/settlements`}
                                className="p-0.5 rounded hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors"
                                title={`Settle Up in ${gi.groupName}`}
                              >
                                <ChevronRight className="h-3 w-3" />
                              </Link>
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
  );
};

export default PersonalDebtSummaryCard;
