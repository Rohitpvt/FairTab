/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { useMemberNameResolver } from "../../hooks/useMemberNameResolver";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Settings,
  Users,
  Plus,
  UserPlus,
  CloudOff,
  RefreshCw,
  LogOut,
  HandCoins,
  ChevronRight,
} from "lucide-react";
import { PageContainer } from "../../components/layout/PageContainer";
import { groupService } from "../../infrastructure/firebase/groupService";
import { auth } from "../../infrastructure/firebase/firebase";
import type { GroupDocument } from "./groupSchema";
import type { GroupMemberDocument } from "./memberSchema";
import type { ActivityDocument } from "./activitySchema";
import { Button } from "../../components/ui/Button";
import { Skeleton, BalanceCardSkeleton, ExpenseRowSkeleton, MemberRowSkeleton } from "../../components/ui/Skeleton";
import { formatCurrency } from "../../utils/format";
import {
  canEditSettings,
  canInviteMember,
  canLeaveGroup,
  canChangeRole
} from "./permissions";

import InviteMemberDialog from "./InviteMemberDialog";
import AddPlaceholderDialog from "./AddPlaceholderDialog";
import RemoveMemberDialog from "./RemoveMemberDialog";
import LeaveGroupDialog from "./LeaveGroupDialog";
import { toast } from "sonner";

// Phase 4 imports
import { expenseService } from "../../infrastructure/firebase/expenseService";
import { settlementService } from "../../infrastructure/firebase/settlementService";
import { calculateBalances, simplifyMinimumTransactions, simplifyPreserveRelationships } from "@fairtab/domain";
import type { ExpenseDocument, SettlementDocument } from "@fairtab/domain";
import ExpenseListPage from "../expenses/ExpenseListPage";
import ConflictResolutionDialog from "../expenses/ConflictResolutionDialog";
import { PersonalDebtSummaryCard } from "../../components/dashboard/PersonalDebtSummaryCard";
import { MemberLedgerModal } from "../../components/dashboard/MemberLedgerModal";
import { offlineDb } from "../../infrastructure/offline/db";
import { syncManager } from "../../infrastructure/offline/syncManager";

export const GroupDetailPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();

  const [group, setGroup] = useState<GroupDocument | null>(null);
  const [members, setMembers] = useState<GroupMemberDocument[]>([]);
  const [activities, setActivities] = useState<ActivityDocument[]>([]);
  const [expenses, setExpenses] = useState<ExpenseDocument[]>([]);
  const [settlements, setSettlements] = useState<SettlementDocument[]>([]);
  const [conflictOp, setConflictOp] = useState<any>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [hasPendingWrites, setHasPendingWrites] = useState(false);

  // Dialog states
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isPlaceholderOpen, setIsPlaceholderOpen] = useState(false);
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  
  // Member delete dialog state
  const [selectedRemoveMember, setSelectedRemoveMember] = useState<{
    id: string;
    displayName: string;
    kind: "account" | "placeholder";
  } | null>(null);

  // Member ledger inspector state
  const [selectedLedgerMember, setSelectedLedgerMember] = useState<GroupMemberDocument | null>(null);

  const isOffline = !navigator.onLine;
  const { resolveName, memberNameMap } = useMemberNameResolver(members);

  useEffect(() => {
    if (!groupId) return;

    const unsubscribeGroup = groupService.watchGroup(groupId, (data, cache, pending) => {
      if (data) {
        setGroup(data);
        setFromCache(cache);
        setHasPendingWrites(pending);
      } else {
        setGroup(null);
      }
      setIsLoading(false);
    });

    const unsubscribeMembers = groupService.watchMembers(groupId, (data) => {
      setMembers(data);
    });

    const unsubscribeActivities = groupService.watchActivities(groupId, (data) => {
      setActivities(data);
    });

    const unsubscribeExpenses = expenseService.watchExpenses(groupId, (data) => {
      setExpenses(data);
    });

    const unsubscribeSettlements = settlementService.watchSettlements(groupId, (data) => {
      setSettlements(data);
    });

    return () => {
      unsubscribeGroup();
      unsubscribeMembers();
      unsubscribeActivities();
      unsubscribeExpenses();
      unsubscribeSettlements();
    };
  }, [groupId]);

  useEffect(() => {
    let active = true;
    const fetchConflicts = async () => {
      if (!groupId) return;
      try {
        const currentUid = auth.currentUser?.uid || "anonymous";
        const failedOps = await offlineDb.expenseOutbox
          .where("groupId")
          .equals(groupId)
          .and((op) => op.status === "failed" && !!op.errorDetails && op.uid === currentUid)
          .toArray();
        if (active) {
          if (failedOps.length > 0) {
            setConflictOp(failedOps[0]);
          } else {
            setConflictOp(null);
          }
        }
      } catch (e) {
        console.error("Failed to read IndexedDB outbox conflicts", e);
      }
    };

    fetchConflicts();
    const unsub = syncManager.registerListener(() => {
      fetchConflicts();
    });
    return () => {
      active = false;
      unsub();
    };
  }, [groupId]);

  const handleResolveConflict = async (action: "reapply" | "keep_server") => {
    if (!conflictOp) return;

    try {
      if (action === "keep_server") {
        await offlineDb.expenseOutbox.delete(conflictOp.clientOperationId);
        toast.info("Discarded local edit in favor of the cloud version.");
      } else if (action === "reapply") {
        const localDraft = conflictOp.payload;
        await offlineDb.expenseOutbox.delete(conflictOp.clientOperationId);
        toast.info("Loading edit form to manually reapply your changes...");
        navigate(`/groups/${groupId}/expenses/${conflictOp.payload.expenseId}/edit`, {
          state: { localDraft },
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to resolve conflict.");
    } finally {
      setConflictOp(null);
    }
  };

  if (isLoading) {
    return (
      <PageContainer title="Loading Group..." description="Reading group split logs...">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <BalanceCardSkeleton />
          <BalanceCardSkeleton />
          <BalanceCardSkeleton />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
            <ExpenseRowSkeleton />
            <ExpenseRowSkeleton />
            <ExpenseRowSkeleton />
          </div>
          <div className="flex flex-col gap-4">
            <Skeleton className="h-6 w-28" />
            <div className="glass-elevated border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
              <MemberRowSkeleton />
              <MemberRowSkeleton />
              <MemberRowSkeleton />
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!group) {
    return (
      <PageContainer title="Group Not Found" description="The requested group does not exist or you lack permission.">
        <div className="max-w-md mx-auto text-center mt-12">
          <Button onClick={() => navigate("/groups")} variant="gradient" className="w-full">
            Return to Groups List
          </Button>
        </div>
      </PageContainer>
    );
  }

  const currentUserUid = auth.currentUser?.uid;
  const currentMember = members.find((m) => m.userId === currentUserUid);
  const currentUserRole = currentMember?.role || "viewer";

  const activeMemberUserIds = members
    .filter((m) => m.kind === "account" && m.status === "active")
    .map((m) => m.userId || "");

  const handleRoleChange = async (member: GroupMemberDocument, newRole: "admin" | "member" | "viewer") => {
    if (isOffline) {
      toast.error("A connection is required for this membership change.");
      return;
    }
    const isSelf = member.userId === currentUserUid;
    if (!canChangeRole(currentUserRole, member.role, newRole, isSelf)) {
      toast.error("You lack permission to perform this role transition.");
      return;
    }

    try {
      await groupService.updateMemberRole(group.id, member.id, resolveName(member), newRole);
      toast.success(`Updated role for ${resolveName(member)} to ${newRole}.`);
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      toast.error(err.message || "Failed to update role.");
    }
  };

  // Group-level balance & individual debt calculation for the logged-in user
  const activeMembers = members.filter((m) => m.status === "active");
  const formerMembers = members.filter((m) => m.status === "removed" || m.status === "left");
  const allMemberIds = Array.from(
    new Set([
      ...members.map((m) => m.id),
      ...expenses.flatMap((e) => [...e.payers.map((p) => p.memberId), ...e.splits.map((s) => s.memberId)]),
      ...settlements.flatMap((s) => [s.payerId, s.receiverId]),
    ])
  );
  const activeExpenses = expenses.filter((e) => e.status !== "voided");
  const balances = calculateBalances(activeExpenses, settlements, allMemberIds);

  const userMember = currentMember;
  const userMemberId = userMember?.id || currentUserUid || "";

  const userBalObj = balances.find((b) => b.memberId === userMemberId || b.memberId === currentUserUid);
  const userNetMinor = userBalObj ? userBalObj.netBaseMinor : 0;

  // Use group strategy or default
  const recommendations =
    group.settlementStrategy === "minimum_transactions"
      ? simplifyMinimumTransactions(balances)
      : simplifyPreserveRelationships(activeExpenses, settlements, allMemberIds);

  const groupUserBreakdowns: {
    id: string;
    groupId: string;
    groupName: string;
    otherMemberId: string;
    otherMemberName: string;
    amountMinor: number;
    currency: string;
    type: "owed_to_user" | "user_owes";
  }[] = [];

  let groupTotalOwed = 0;
  let groupTotalOwes = 0;

  recommendations.forEach((rec) => {
    if (rec.toMemberId === userMemberId || rec.toMemberId === currentUserUid) {
      // Someone owes user
      const otherMem = members.find((m) => m.id === rec.fromMemberId || m.userId === rec.fromMemberId);
      const isFormer = otherMem && (otherMem.status === "removed" || otherMem.status === "left");
      const name = otherMem
        ? `${resolveName(otherMem)}${isFormer ? " (Former)" : ""}`
        : "Former Member";
      groupTotalOwed += rec.amountMinor;
      groupUserBreakdowns.push({
        id: `${group.id}:${rec.fromMemberId}->${rec.toMemberId}`,
        groupId: group.id,
        groupName: group.name,
        otherMemberId: rec.fromMemberId,
        otherMemberName: name,
        amountMinor: rec.amountMinor,
        currency: group.baseCurrency,
        type: "owed_to_user",
      });
    } else if (rec.fromMemberId === userMemberId || rec.fromMemberId === currentUserUid) {
      // User owes someone
      const otherMem = members.find((m) => m.id === rec.toMemberId || m.userId === rec.toMemberId);
      const isFormer = otherMem && (otherMem.status === "removed" || otherMem.status === "left");
      const name = otherMem
        ? `${resolveName(otherMem)}${isFormer ? " (Former)" : ""}`
        : "Former Member";
      groupTotalOwes += rec.amountMinor;
      groupUserBreakdowns.push({
        id: `${group.id}:${rec.fromMemberId}->${rec.toMemberId}`,
        groupId: group.id,
        groupName: group.name,
        otherMemberId: rec.toMemberId,
        otherMemberName: name,
        amountMinor: rec.amountMinor,
        currency: group.baseCurrency,
        type: "user_owes",
      });
    }
  });

  return (
    <PageContainer
      title={group.name}
      description={group.description || `Split ledger group using ${group.baseCurrency}.`}
      action={
        <div className="flex flex-wrap items-center gap-2">
          {canInviteMember(currentUserRole) && group.status === "active" && (
            <Button
              onClick={() => {
                if (group.memberUserIds.length >= 100) {
                  toast.error("Cannot invite members: limit of 100 has been reached.");
                  return;
                }
                setIsInviteOpen(true);
              }}
              variant="gradient"
              size="sm"
              className="flex items-center gap-1.5 text-xs shadow-lg shadow-accent-cyan/10"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Invite</span>
            </Button>
          )}
          <Link to={`/groups/${group.id}/settlements`}>
            <Button variant="secondary" size="sm" className="flex items-center gap-1.5 text-xs">
              <HandCoins className="h-3.5 w-3.5" />
              <span>Settlements</span>
            </Button>
          </Link>
          {canEditSettings(currentUserRole) && (
            <Link to={`/groups/${group.id}/settings`}>
              <Button variant="secondary" size="sm" className="flex items-center gap-1.5 text-xs">
                <Settings className="h-3.5 w-3.5" />
                <span>Settings</span>
              </Button>
            </Link>
          )}
          {canLeaveGroup(currentUserRole) && (
            <Button onClick={() => setIsLeaveOpen(true)} variant="ghost" size="sm" className="flex items-center gap-1.5 text-danger hover:bg-danger/5 text-xs border border-transparent hover:border-danger/20">
              <LogOut className="h-3.5 w-3.5" />
              <span>Leave</span>
            </Button>
          )}
        </div>
      }
    >
      {/* Personal Group Debt Breakdown Header */}
      <PersonalDebtSummaryCard
        totalNetMinor={userNetMinor}
        totalOwedMinor={groupTotalOwed}
        totalOwesMinor={groupTotalOwes}
        currency={group.baseCurrency}
        breakdowns={groupUserBreakdowns}
        expensesMap={{ [group.id]: expenses }}
        settlementsMap={{ [group.id]: settlements }}
        currentUserId={userMemberId}
        className="mb-6"
        isGroupContext={true}
      />

      {/* Offline and Caching Alert Banners */}
      <div className="flex flex-col gap-3 mb-6">
        {fromCache && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-accent-indigo/10 border border-accent-indigo/20 rounded-xl text-accent-cyan text-xs">
            <CloudOff className="h-4 w-4 shrink-0" />
            <span>Viewing offline cached copy. Some updates may be pending sync.</span>
          </div>
        )}
        {hasPendingWrites && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-warning/10 border border-warning/20 rounded-xl text-warning text-xs">
            <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
            <span>Pending database upload...</span>
          </div>
        )}
        {group.status === "archived" && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-warning/10 border border-warning/20 rounded-xl text-warning text-xs font-semibold">
            <span>⚠️ This group is archived and is read-only. No new ledger balances can be split.</span>
          </div>
        )}
        {group.status === "deleted" && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-danger/10 border border-danger/20 rounded-xl text-danger text-xs font-semibold">
            <span>🚫 This group is permanently soft-deleted and is read-only. Access is restricted.</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Side: Summary & Actions */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Expense Ledger List */}
          <div className="glass-elevated border border-white/10 rounded-2xl p-6">
            <ExpenseListPage
              groupId={group.id}
              members={members}
              groupBaseCurrency={group.baseCurrency}
              isArchived={group.status === "archived" || group.status === "deleted"}
            />
          </div>
        </div>

        {/* Right Side: Unified Members & Balances Card */}
        <div className="flex flex-col gap-6">
          <div className="glass-elevated border border-white/10 rounded-2xl p-5 sm:p-6 text-left">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <Users className="h-4 w-4 text-accent-cyan" />
                  Members ({group.activeMemberCount})
                </h3>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Tap any member to view their ledger & settlements
                </p>
              </div>

              {/* Quick Actions for Owner/Admins */}
              {canInviteMember(currentUserRole) && group.status === "active" && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    onClick={() => {
                      if (group.memberUserIds.length >= 100) {
                        toast.error("Cannot invite members: limit of 100 has been reached.");
                        return;
                      }
                      setIsInviteOpen(true);
                    }}
                    variant="ghost"
                    size="sm"
                    className="text-accent-cyan hover:bg-white/5 h-8 px-2.5"
                    title="Invite via URL link"
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-1" />
                    <span className="text-xs">Invite</span>
                  </Button>
                  <Button
                    onClick={() => setIsPlaceholderOpen(true)}
                    variant="ghost"
                    size="sm"
                    className="text-accent-indigo hover:bg-white/5 h-8 px-2"
                    title="Add Placeholder Member"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2.5">
              {activeMembers.map((member) => {
                const isSelf = member.userId === currentUserUid;
                const memBalObj = balances.find((b) => b.memberId === member.id || (member.userId && b.memberId === member.userId));
                const memNetMinor = memBalObj ? memBalObj.netBaseMinor : 0;
                const isPositive = memNetMinor > 0;
                const isNegative = memNetMinor < 0;

                return (
                  <div
                    key={member.id}
                    onClick={() => setSelectedLedgerMember(member)}
                    className="flex items-center justify-between p-3 bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/15 rounded-2xl transition-all cursor-pointer group"
                  >
                    {/* Left: Avatar + Name + Role */}
                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          member.kind === "placeholder"
                            ? "bg-accent-indigo/15 text-accent-indigo border border-accent-indigo/25"
                            : isSelf
                            ? "bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/25"
                            : "bg-white/5 text-text-secondary border border-white/10"
                        }`}
                      >
                        {member.kind === "placeholder" ? (
                          <CloudOff className="h-4 w-4" />
                        ) : (
                          (resolveName(member).charAt(0) || "M").toUpperCase()
                        )}
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-text-primary flex items-center gap-1.5 truncate group-hover:text-accent-cyan transition-colors">
                          <span className="truncate">{resolveName(member)}</span>
                          {isSelf && (
                            <span className="text-[9px] font-semibold bg-accent-cyan/10 border border-accent-cyan/20 px-1 rounded text-accent-cyan shrink-0">
                              You
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-text-muted capitalize truncate">
                          {member.kind === "placeholder" ? "Offline Placeholder" : member.role}
                        </span>
                      </div>
                    </div>

                    {/* Right: Net Balance Pill + Chevron */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-xl border ${
                          isPositive
                            ? "bg-success/10 text-success border-success/20"
                            : isNegative
                            ? "bg-danger/10 text-danger border-danger/20"
                            : "bg-white/5 text-text-muted border-white/10"
                        }`}
                      >
                        {isPositive ? "+" : ""}
                        {formatCurrency(memNetMinor, group.baseCurrency)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-text-muted opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                );
              })}

              {/* Former / Inactive Members */}
              {formerMembers.length > 0 && (
                <div className="mt-2 pt-3 border-t border-white/5 flex flex-col gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Former Members ({formerMembers.length})
                  </span>
                  {formerMembers.map((member) => {
                    const memBalObj = balances.find((b) => b.memberId === member.id || (member.userId && b.memberId === member.userId));
                    const memNetMinor = memBalObj ? memBalObj.netBaseMinor : 0;
                    const isPositive = memNetMinor > 0;
                    const isNegative = memNetMinor < 0;

                    return (
                      <div
                        key={member.id}
                        onClick={() => setSelectedLedgerMember(member)}
                        className="flex items-center justify-between p-2.5 bg-white/[0.01] hover:bg-white/[0.04] border border-white/5 rounded-xl opacity-75 hover:opacity-100 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                          <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-bold text-xs text-text-muted shrink-0">
                            {(resolveName(member).charAt(0) || "M").toUpperCase()}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium text-text-secondary truncate group-hover:text-text-primary">
                              {resolveName(member)}
                            </span>
                            <span className="text-[10px] text-text-muted capitalize">
                              {member.status === "left" ? "Left Group" : "Removed"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {memNetMinor !== 0 && (
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-lg border ${
                                isPositive
                                  ? "bg-success/10 text-success border-success/20"
                                  : isNegative
                                  ? "bg-danger/10 text-danger border-danger/20"
                                  : "bg-white/5 text-text-muted border-white/10"
                              }`}
                            >
                              {isPositive ? "+" : ""}
                              {formatCurrency(memNetMinor, group.baseCurrency)}
                            </span>
                          )}
                          <ChevronRight className="h-3.5 w-3.5 text-text-muted opacity-40 group-hover:opacity-100 transition-all" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
    </div>

      {/* Activity Logs Timeline — Full Width at Bottom */}
      <div className="glass-elevated border border-white/10 rounded-2xl p-6 text-left">
        <h3 className="text-base font-bold text-text-primary mb-4">Recent Activity Feed</h3>
        {activities.length === 0 ? (
          <p className="text-xs text-text-muted">No group timeline events logged yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {activities.map((act) => (
              <div key={act.id} className="flex gap-3 text-xs leading-relaxed items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan mt-1.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-text-secondary">{act.summary}</p>
                  <span className="text-[10px] text-text-muted">
                    {(act.createdAt as { seconds: number })?.seconds
                      ? new Date((act.createdAt as { seconds: number }).seconds * 1000).toLocaleString()
                      : "Just now"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Modals */}
      <InviteMemberDialog
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        groupId={group.id}
        groupName={group.name}
      />

      <AddPlaceholderDialog
        isOpen={isPlaceholderOpen}
        onClose={() => setIsPlaceholderOpen(false)}
        groupId={group.id}
        groupVersion={group.version}
      />

      <LeaveGroupDialog
        isOpen={isLeaveOpen}
        onClose={() => setIsLeaveOpen(false)}
        groupId={group.id}
        groupName={group.name}
        activeMemberUserIds={activeMemberUserIds}
        groupVersion={group.version}
      />

      {selectedRemoveMember && (
        <RemoveMemberDialog
          isOpen={!!selectedRemoveMember}
          onClose={() => setSelectedRemoveMember(null)}
          groupId={group.id}
          memberId={selectedRemoveMember.id}
          displayName={selectedRemoveMember.displayName}
          kind={selectedRemoveMember.kind}
          activeMemberUserIds={activeMemberUserIds}
          groupVersion={group.version}
        />
      )}

      {/* Member Ledger Modal */}
      {selectedLedgerMember && (
        <MemberLedgerModal
          isOpen={!!selectedLedgerMember}
          onClose={() => setSelectedLedgerMember(null)}
          groupId={group.id}
          groupName={group.name}
          currency={group.baseCurrency}
          member={selectedLedgerMember}
          allMembers={members}
          expenses={expenses}
          settlements={settlements}
          settlementStrategy={group.settlementStrategy}
          currentUserRole={currentUserRole}
          currentUserUid={currentUserUid}
          onRoleChange={handleRoleChange}
          onRemoveMember={(m) =>
            setSelectedRemoveMember({
              id: m.id,
              displayName: resolveName(m),
              kind: m.kind,
            })
          }
        />
      )}

      {/* Conflict Resolution Dialog */}
      {conflictOp && (
        <ConflictResolutionDialog
          isOpen={!!conflictOp}
          onClose={() => setConflictOp(null)}
          localData={conflictOp.payload}
          serverData={conflictOp.errorDetails.serverDocument}
          memberNames={memberNameMap}
          onResolve={handleResolveConflict}
        />
      )}
    </PageContainer>
  );
};

export default GroupDetailPage;
