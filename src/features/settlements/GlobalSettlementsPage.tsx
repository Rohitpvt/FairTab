import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeftRight, Check, ArrowUpRight, Scale } from "lucide-react";
import { PageContainer } from "../../components/layout/PageContainer";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Button } from "../../components/ui/Button";
import { BalanceCardSkeleton } from "../../components/ui/Skeleton";
import { useAuth } from "../auth/AuthProvider";
import { groupService } from "../../infrastructure/firebase/groupService";
import { expenseService } from "../../infrastructure/firebase/expenseService";
import { settlementService } from "../../infrastructure/firebase/settlementService";
import { calculateBalances, simplifyMinimumTransactions } from "@fairtab/domain";
import type { UserGroupIndexDocument } from "../groups/userGroupIndexSchema";
import type { ExpenseDocument, SettlementDocument } from "@fairtab/domain";
import type { GroupMemberDocument } from "../groups/memberSchema";
import { resolveMemberName } from "../../hooks/useMemberNameResolver";
import { formatCurrency } from "../../utils/format";

interface GroupData {
  groupId: string;
  groupName: string;
  baseCurrency: string;
  members: GroupMemberDocument[];
  expenses: ExpenseDocument[];
  settlements: SettlementDocument[];
}

export const GlobalSettlementsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const currentUid = user?.uid;

  const [isLoading, setIsLoading] = useState(true);
  const [groupsIndex, setGroupsIndex] = useState<UserGroupIndexDocument[]>([]);
  const [groupsData, setGroupsData] = useState<Record<string, GroupData>>({});

  // 1. Listen to user's active groups
  useEffect(() => {
    if (!currentUid) return;

    const unsubscribeGroups = groupService.watchUserGroups((userGroups) => {
      const active = userGroups.filter((g) => g.status === "active");
      setGroupsIndex(active);
      if (active.length === 0) {
        setIsLoading(false);
      }
    });

    return () => unsubscribeGroups();
  }, [currentUid]);

  // 2. Fetch data (members, expenses, settlements) for each active group dynamically
  useEffect(() => {
    if (groupsIndex.length === 0) return;

    const unsubscribes: (() => void)[] = [];
    groupsIndex.forEach((g) => {
      let members: GroupMemberDocument[] = [];
      let expenses: ExpenseDocument[] = [];
      let settlements: SettlementDocument[] = [];

      const updateGroupData = () => {
        setGroupsData((prev) => ({
          ...prev,
          [g.groupId]: {
            groupId: g.groupId,
            groupName: g.groupName,
            baseCurrency: prev[g.groupId]?.baseCurrency || "INR",
            members,
            expenses,
            settlements,
          },
        }));
      };

      const unsubGroup = groupService.watchGroup(g.groupId, (groupDoc) => {
        if (groupDoc) {
          setGroupsData((prev) => ({
            ...prev,
            [g.groupId]: {
              ...(prev[g.groupId] || {
                groupId: g.groupId,
                groupName: g.groupName,
                members: [],
                expenses: [],
                settlements: [],
              }),
              baseCurrency: groupDoc.baseCurrency,
            },
          }));
        }
      });
      unsubscribes.push(unsubGroup);

      const unsubMembers = groupService.watchMembers(g.groupId, (memberList) => {
        members = memberList.filter((m) => m.status === "active");
        updateGroupData();
      });
      unsubscribes.push(unsubMembers);

      const unsubExpenses = expenseService.watchExpenses(g.groupId, (expList) => {
        expenses = expList.filter((e) => e.status === "active");
        updateGroupData();
      });
      unsubscribes.push(unsubExpenses);

      const unsubSettlements = settlementService.watchSettlements(g.groupId, (setList) => {
        settlements = setList;
        updateGroupData();
      });
      unsubscribes.push(unsubSettlements);
    });

    // Assume loaded after short delay to aggregate initial streams
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);

    return () => {
      clearTimeout(timer);
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [groupsIndex]);

  // 3. Compute balances, suggested actions, and summaries by currency
  const computedData = useMemo(() => {
    const currencySummary: Record<string, { owe: number; owed: number }> = {};
    const globalSuggestedSettlements: {
      groupId: string;
      groupName: string;
      currency: string;
      fromMemberId: string;
      fromMemberName: string;
      toMemberId: string;
      toMemberName: string;
      amountMinor: number;
    }[] = [];
    const recentSettlementsList: {
      id: string;
      groupId: string;
      groupName: string;
      payerId: string;
      payerName: string;
      receiverId: string;
      receiverName: string;
      amountMinor: number;
      currency: string;
      createdAt: { seconds: number } | null | undefined;
      status: "active" | "voided";
    }[] = [];

    const memberLookup = (groupId: string, memberId: string): string => {
      const g = groupsData[groupId];
      if (!g) return memberId;
      const m = g.members.find((member) => member.id === memberId);
      if (!m) return memberId;
      return resolveMemberName(m, currentUid, profile?.displayName);
    };

    Object.values(groupsData).forEach((g) => {
      const activeMemberIds = g.members.map((m) => m.id);
      const groupUserMember = g.members.find((m) => m.userId === currentUid);
      const groupUserMemberId = groupUserMember?.id;

      // Calculate net balances per member
      const balances = calculateBalances(g.expenses, g.settlements, activeMemberIds);

      // Add user balance to overall currency summary
      if (groupUserMemberId) {
        const userBal = balances.find((b) => b.memberId === groupUserMemberId);
        if (userBal) {
          const netAmount = userBal.netBaseMinor;
          const curr = g.baseCurrency;
          if (!currencySummary[curr]) {
            currencySummary[curr] = { owe: 0, owed: 0 };
          }
          if (netAmount > 0) {
            currencySummary[curr].owed += netAmount;
          } else if (netAmount < 0) {
            currencySummary[curr].owe += Math.abs(netAmount);
          }
        }
      }

      // Compute suggested minimum transactions for debt simplification
      const simplifications = simplifyMinimumTransactions(balances);
      simplifications.forEach((sim) => {
        // Only include suggested settlements directly involving the current authenticated user
        const involvesCurrentUser =
          groupUserMemberId && (sim.fromMemberId === groupUserMemberId || sim.toMemberId === groupUserMemberId);

        if (involvesCurrentUser) {
          globalSuggestedSettlements.push({
            groupId: g.groupId,
            groupName: g.groupName,
            currency: g.baseCurrency,
            fromMemberId: sim.fromMemberId,
            fromMemberName: memberLookup(g.groupId, sim.fromMemberId),
            toMemberId: sim.toMemberId,
            toMemberName: memberLookup(g.groupId, sim.toMemberId),
            amountMinor: sim.amountMinor,
          });
        }
      });

      // Accumulate recent settlements
      g.settlements.forEach((set) => {
        const involvesUser =
          groupUserMemberId && (set.payerId === groupUserMemberId || set.receiverId === groupUserMemberId);

        if (involvesUser) {
          recentSettlementsList.push({
            id: set.id,
            groupId: g.groupId,
            groupName: g.groupName,
            payerId: set.payerId,
            payerName: memberLookup(g.groupId, set.payerId),
            receiverId: set.receiverId,
            receiverName: memberLookup(g.groupId, set.receiverId),
            amountMinor: set.amountMinor,
            currency: set.currency,
            createdAt: set.createdAt,
            status: set.status,
          });
        }
      });
    });

    // Sort recent settlements by date descending
    recentSettlementsList.sort((a, b) => {
      const tsA = a.createdAt?.seconds || 0;
      const tsB = b.createdAt?.seconds || 0;
      return tsB - tsA;
    });

    return {
      currencySummary,
      suggestedSettlements: globalSuggestedSettlements,
      recentSettlements: recentSettlementsList,
    };
  }, [groupsData, currentUid, profile]);

  if (isLoading) {
    return (
      <PageContainer title="Settlements" description="Analyzing ledger balances...">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <BalanceCardSkeleton />
          <BalanceCardSkeleton />
        </div>
      </PageContainer>
    );
  }

  const { currencySummary, suggestedSettlements, recentSettlements } = computedData;
  const hasGroups = groupsIndex.length > 0;

  return (
    <PageContainer
      title="Global Settlements"
      description="Manage repayments and view debts across all your active groups."
    >
      {!hasGroups ? (
        <div className="text-center py-12 max-w-md mx-auto">
          <Scale className="h-12 w-12 text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-bold text-text-primary mb-2">No Active Groups Found</h3>
          <p className="text-sm text-text-muted mb-6">
            You must belong to at least one active group to track balances and suggested settlements.
          </p>
          <Button onClick={() => navigate("/groups")} variant="gradient" className="w-full">
            View My Groups
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Summary Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* You Owe Card */}
            <div className="glass-elevated border border-white/5 rounded-2xl p-5 text-left">
              <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">You Owe</h4>
              <div className="flex flex-col gap-2">
                {Object.keys(currencySummary).length === 0 ||
                Object.values(currencySummary).every((s) => s.owe === 0) ? (
                  <span className="text-xl font-bold text-text-muted">No debts</span>
                ) : (
                  Object.entries(currencySummary).map(([curr, sum]) =>
                    sum.owe > 0 ? (
                      <div key={curr} className="flex justify-between items-center">
                        <span className="text-2xl font-bold text-danger">
                          {formatCurrency(sum.owe, curr)}
                        </span>
                        <span className="text-xs text-text-muted font-semibold uppercase">{curr}</span>
                      </div>
                    ) : null
                  )
                )}
              </div>
            </div>

            {/* You Are Owed Card */}
            <div className="glass-elevated border border-white/5 rounded-2xl p-5 text-left">
              <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">You Are Owed</h4>
              <div className="flex flex-col gap-2">
                {Object.keys(currencySummary).length === 0 ||
                Object.values(currencySummary).every((s) => s.owed === 0) ? (
                  <span className="text-xl font-bold text-text-muted">Nobody owes you</span>
                ) : (
                  Object.entries(currencySummary).map(([curr, sum]) =>
                    sum.owed > 0 ? (
                      <div key={curr} className="flex justify-between items-center">
                        <span className="text-2xl font-bold text-success">
                          {formatCurrency(sum.owed, curr)}
                        </span>
                        <span className="text-xs text-text-muted font-semibold uppercase">{curr}</span>
                      </div>
                    ) : null
                  )
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Suggested Settlements Section */}
            <div className="lg:col-span-2 flex flex-col gap-4 text-left">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Suggested Settlements</h3>
              <div className="flex flex-col gap-3">
                {suggestedSettlements.length === 0 ? (
                  <div className="p-6 text-center bg-white/[0.02] border border-white/5 rounded-2xl">
                    <p className="text-xs text-text-muted">All balances are completely settled up!</p>
                  </div>
                ) : (
                  suggestedSettlements.map((sim, index) => {
                    const isSender = groupsData[sim.groupId]?.members.find(m => m.id === sim.fromMemberId)?.userId === currentUid;
                    return (
                      <GlassPanel
                        key={`${sim.groupId}-${index}`}
                        variant="subtle"
                        className="p-4 flex items-center justify-between border border-white/5 rounded-2xl hover:border-white/10 transition-all"
                      >
                        <div>
                          <span className="text-[10px] font-bold text-accent-cyan uppercase tracking-wider block mb-0.5">
                            {sim.groupName}
                          </span>
                          <div className="text-sm text-text-primary font-medium flex items-center gap-1.5">
                            <span>{sim.fromMemberName}</span>
                            <ArrowLeftRight className="h-3.5 w-3.5 text-text-muted" />
                            <span>{sim.toMemberName}</span>
                          </div>
                          <span className="text-[10px] text-text-muted block mt-1">
                            {isSender ? "You need to pay" : "You should receive"}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-base font-bold text-text-primary">
                            {formatCurrency(sim.amountMinor, sim.currency)}
                          </span>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              navigate(
                                `/groups/${sim.groupId}/settlements/new?from=${sim.fromMemberId}&to=${sim.toMemberId}&amount=${sim.amountMinor / 100}`
                              )
                            }
                          >
                            Record
                          </Button>
                        </div>
                      </GlassPanel>
                    );
                  })
                )}
              </div>
            </div>

            {/* Recent Settlements History Section */}
            <div className="flex flex-col gap-4 text-left">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Recent Settlement History</h3>
              <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-1">
                {recentSettlements.length === 0 ? (
                  <div className="p-6 text-center bg-white/[0.02] border border-white/5 rounded-2xl">
                    <p className="text-xs text-text-muted">No settlements logged yet.</p>
                  </div>
                ) : (
                  recentSettlements.map((set) => (
                    <Link
                      key={set.id}
                      to={`/groups/${set.groupId}/settlements/${set.id}`}
                      className="block group"
                    >
                      <GlassPanel
                        variant="subtle"
                        className="p-4 flex items-center justify-between border border-white/5 rounded-2xl hover:bg-white/5 hover:border-white/10 transition-colors"
                      >
                        <div className="min-w-0">
                          <span className="text-[9px] font-semibold text-text-muted block mb-0.5 uppercase tracking-wide">
                            {set.groupName}
                          </span>
                          <div className="flex items-center gap-1.5 font-semibold text-text-primary text-xs">
                            <span className="truncate max-w-[80px]">{set.payerName}</span>
                            <ArrowLeftRight className="h-3 w-3 text-text-muted shrink-0" />
                            <span className="truncate max-w-[80px]">{set.receiverName}</span>
                          </div>
                          <span className="text-[10px] text-text-muted mt-1 block">
                            {set.createdAt?.seconds
                              ? new Date(set.createdAt.seconds * 1000).toLocaleDateString()
                              : "Just now"}
                          </span>
                        </div>
                        <div className="text-right flex-shrink-0 flex items-center gap-2">
                          <div>
                            <span className="font-bold text-text-primary text-xs">
                              {formatCurrency(set.amountMinor, set.currency)}
                            </span>
                            {set.status === "voided" ? (
                              <div className="text-[9px] text-danger mt-0.5 font-semibold">Voided</div>
                            ) : (
                              <div className="flex items-center justify-end gap-1 text-[9px] text-success/80 mt-0.5">
                                <Check className="h-3.5 w-3.5" />
                                <span>Cleared</span>
                              </div>
                            )}
                          </div>
                          <ArrowUpRight className="h-4 w-4 text-text-muted group-hover:text-text-primary transition-colors" />
                        </div>
                      </GlassPanel>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};
export default GlobalSettlementsPage;
