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
  UserMinus,
  HandCoins,
} from "lucide-react";
import { PageContainer } from "../../components/layout/PageContainer";
import { groupService } from "../../infrastructure/firebase/groupService";
import { auth } from "../../infrastructure/firebase/firebase";
import type { GroupDocument } from "./groupSchema";
import type { GroupMemberDocument } from "./memberSchema";
import type { ActivityDocument } from "./activitySchema";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import {
  canEditSettings,
  canInviteMember,
  canLeaveGroup,
  canRemoveMember,
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
import type { ExpenseDocument, SettlementDocument } from "@fairtab/domain";
import BalanceProjectionCard from "../expenses/BalanceProjectionCard";
import ExpenseListPage from "../expenses/ExpenseListPage";
import ConflictResolutionDialog from "../expenses/ConflictResolutionDialog";
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
        <div className="flex flex-col gap-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
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

  return (
    <PageContainer
      title={group.name}
      description={group.description || `Split ledger group using ${group.baseCurrency}.`}
      action={
        <div className="flex gap-2">
          <Link to={`/groups/${group.id}/settlements`}>
            <Button variant="secondary" size="sm" className="flex gap-1.5">
              <HandCoins className="h-4 w-4" />
              Settlements
            </Button>
          </Link>
          {canEditSettings(currentUserRole) && (
            <Link to={`/groups/${group.id}/settings`}>
              <Button variant="secondary" size="sm" className="flex gap-1.5">
                <Settings className="h-4 w-4" />
                Settings
              </Button>
            </Link>
          )}
          {canLeaveGroup(currentUserRole) && (
            <Button onClick={() => setIsLeaveOpen(true)} variant="ghost" size="sm" className="flex gap-1.5 text-danger hover:bg-danger/5">
              <LogOut className="h-4 w-4" />
              Leave Group
            </Button>
          )}
        </div>
      }
    >
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

          {/* Activity Logs Timeline */}
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
        </div>

        {/* Right Side: Balance Projection & Members */}
        <div className="flex flex-col gap-6">
          <BalanceProjectionCard
            expenses={expenses}
            settlements={settlements}
            members={members}
            baseCurrency={group.baseCurrency}
          />

          <div className="glass-elevated border border-white/10 rounded-2xl p-6 text-left">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                <Users className="h-4 w-4 text-accent-cyan" />
                Members ({group.activeMemberCount})
              </h3>
              {/* Quick Actions for Owner/Admins */}
              {canInviteMember(currentUserRole) && group.status === "active" && (
                <div className="flex gap-1.5">
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
                    className="text-accent-cyan hover:bg-white/5"
                    title="Invite via URL link"
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                <Button
                  onClick={() => setIsPlaceholderOpen(true)}
                  variant="ghost"
                  size="sm"
                  className="text-accent-indigo hover:bg-white/5"
                  title="Add Placeholder Member"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {members.map((member) => {
              const isSelf = member.userId === currentUserUid;
              const isOwnerTarget = member.role === "owner";
              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl transition-all hover:bg-white/[0.04]"
                >
                  {/* Name & Badge */}
                  <div className="flex flex-col gap-0.5 text-left">
                    <span className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                      {resolveName(member)}
                      {isSelf && (
                        <span className="text-[9px] font-semibold bg-accent-cyan/10 border border-accent-cyan/20 px-1 rounded text-accent-cyan">
                          You
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-text-muted capitalize flex items-center gap-1">
                      {member.kind === "placeholder" ? "Offline Placeholder" : member.role}
                    </span>
                  </div>

                  {/* Member Actions */}
                  {group.status === "active" && (
                    <div className="flex items-center gap-2">
                      {/* Role dropdown for owner/admin */}
                      {member.kind === "account" && !isOwnerTarget && !isSelf && (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member, e.target.value as "admin" | "member" | "viewer")}
                          className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-text-secondary focus:outline-none focus:border-accent-cyan transition-colors"
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      )}

                      {/* Remove Button */}
                      {canRemoveMember(currentUserRole, member.role) && !isSelf && (
                        <button
                          onClick={() =>
                            setSelectedRemoveMember({
                              id: member.id,
                              displayName: resolveName(member),
                              kind: member.kind
                            })
                          }
                          className="p-1 text-text-muted hover:text-danger rounded hover:bg-danger/10 transition-all"
                          title="Remove from group"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
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
