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
  const peopleWhoOweYou = breakdowns.filter((b) => b.type === "owed_to_user" && b.amountMinor > 0);
  const peopleYouOwe = breakdowns.filter((b) => b.type === "user_owes" && b.amountMinor > 0);

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
              Owed to you ({peopleWhoOweYou.length})
            </span>
          </div>

          {peopleWhoOweYou.length === 0 ? (
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-text-muted">
              No one owes you right now.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {peopleWhoOweYou.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-success/30 hover:bg-white/[0.05] transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-success/10 border border-success/20 flex items-center justify-center text-success font-bold text-xs shrink-0">
                      {item.otherMemberName.slice(0, 2).toUpperCase() || <User className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-text-primary truncate">
                        <span className="text-success font-bold">{item.otherMemberName}</span> owes you
                      </p>
                      {!isGroupContext && item.groupName && (
                        <p className="text-[10px] text-text-muted truncate mt-0.5">
                          in <span className="text-text-secondary">{item.groupName}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-extrabold text-success financial-number">
                      +{formatCurrency(item.amountMinor, item.currency)}
                    </span>
                    {!isGroupContext && (
                      <Link
                        to={`/groups/${item.groupId}/settlements`}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10 text-text-muted hover:text-text-primary"
                        title="View Settlements"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: People YOU owe */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-danger flex items-center gap-1.5">
              <ArrowDownLeft className="h-3.5 w-3.5" />
              You owe ({peopleYouOwe.length})
            </span>
          </div>

          {peopleYouOwe.length === 0 ? (
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-text-muted">
              You don&apos;t owe anyone right now.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {peopleYouOwe.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-danger/30 hover:bg-white/[0.05] transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-danger/10 border border-danger/20 flex items-center justify-center text-danger font-bold text-xs shrink-0">
                      {item.otherMemberName.slice(0, 2).toUpperCase() || <User className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-text-primary truncate">
                        You owe <span className="text-danger font-bold">{item.otherMemberName}</span>
                      </p>
                      {!isGroupContext && item.groupName && (
                        <p className="text-[10px] text-text-muted truncate mt-0.5">
                          in <span className="text-text-secondary">{item.groupName}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-extrabold text-danger financial-number">
                      -{formatCurrency(item.amountMinor, item.currency)}
                    </span>
                    {!isGroupContext && (
                      <Link
                        to={`/groups/${item.groupId}/settlements`}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10 text-text-muted hover:text-text-primary"
                        title="Settle Up"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </GlassPanel>
  );
};

export default PersonalDebtSummaryCard;
