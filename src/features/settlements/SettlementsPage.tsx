import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeftRight, Check, HandCoins, History, ArrowLeft, ArrowUpRight, Clock, X } from "lucide-react";
import { toast } from "sonner";
import { PageContainer } from "../../components/layout/PageContainer";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Button, GradientButton } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import { groupService } from "../../infrastructure/firebase/groupService";
import { expenseService } from "../../infrastructure/firebase/expenseService";
import { settlementService } from "../../infrastructure/firebase/settlementService";
import { syncManager } from "../../infrastructure/offline/syncManager";
import { formatCurrency, formatTimestamp } from "../../utils/format";
import { DebtSimplificationPanel } from "./components/DebtSimplificationPanel";
import type { GroupDocument } from "../groups/groupSchema";
import type { GroupMemberDocument } from "../groups/memberSchema";
import type { ExpenseDocument, SettlementDocument } from "@fairtab/domain";
import { useMemberNameResolver } from "../../hooks/useMemberNameResolver";
import { useAuth } from "../auth/AuthProvider";
import { canEditSettings } from "../groups/permissions";
import {
  getSettlementStatusMeta,
  canApproveOrRejectSettlement,
  canCancelPendingSettlement,
} from "./settlementStatus";

export const SettlementsPage: React.FC = () => {
  const { user } = useAuth();
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();

  const [group, setGroup] = useState<GroupDocument | null>(null);
  const [members, setMembers] = useState<GroupMemberDocument[]>([]);
  const [expenses, setExpenses] = useState<ExpenseDocument[]>([]);
  const [settlements, setSettlements] = useState<SettlementDocument[]>([]);
  const [settlementFilter, setSettlementFilter] = useState<"me" | "all">("me");
  const [processingSettlementId, setProcessingSettlementId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState({
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingCount: 0,
    failedCount: 0,
  });
  const { resolveName } = useMemberNameResolver(members);

  useEffect(() => {
    if (!groupId) return;

    const unsubscribeGroup = groupService.watchGroup(groupId, (data) => {
      setGroup(data);
      setIsLoading(false);
    });

    const unsubscribeMembers = groupService.watchMembers(groupId, (data) => {
      setMembers(data);
    });

    const unsubscribeExpenses = expenseService.watchExpenses(groupId, (data) => {
      setExpenses(data);
    });

    const unsubscribeSettlements = settlementService.watchSettlements(groupId, (data) => {
      setSettlements(data);
      setIsLoading(false);
    });

    const unsubSync = syncManager.registerListener((status) => {
      setSyncStatus(status);
    });

    return () => {
      unsubscribeGroup();
      unsubscribeMembers();
      unsubscribeExpenses();
      unsubscribeSettlements();
      unsubSync();
    };
  }, [groupId]);

  if (isLoading) {
    return (
      <PageContainer title="Reconcile Settlements" description="Preparing debt optimization engine...">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="glass-elevated border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
              <Skeleton className="h-6 w-48" />
              <div className="flex flex-col gap-3">
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="glass-standard border border-white/10 rounded-2xl p-5 flex flex-col gap-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!group) {
    return (
      <PageContainer title="Group Not Found" description="The group you are looking for does not exist.">
        <Button variant="secondary" onClick={() => navigate("/groups")}>
          Back to Groups
        </Button>
      </PageContainer>
    );
  }

  const getMemberName = (id?: string) => {
    if (!id) return "Member";
    const m = members.find((member) => member.id === id);
    if (!m) return id;
    const isFormer = m.status === "removed" || m.status === "left";
    return resolveName(m) + (m.kind === "placeholder" ? " (Placeholder)" : isFormer ? " (Former)" : "");
  };

  const currentMember = members.find((m) => m.userId === user?.uid);
  const currentUserRole = currentMember?.role || "viewer";
  const canManage = canEditSettings(currentUserRole);
  const isArchived = group.status === "archived";

  const actionablePending = settlements.filter(
    (s) =>
      group.status === "active" &&
      (canApproveOrRejectSettlement(s, user?.uid, currentUserRole, members) ||
        canCancelPendingSettlement(s, user?.uid, currentUserRole, members))
  );

  const handleQuickAction = async (
    set: SettlementDocument,
    action: "approve" | "reject" | "cancel"
  ) => {
    if (!groupId) return;
    setProcessingSettlementId(`${set.id}_${action}`);
    try {
      const clientOperationId = `op-${crypto.randomUUID()}`;
      const payload = {
        clientOperationId,
        groupId,
        settlementId: set.id,
        expectedVersion: set.version,
        ...(action === "reject" ? { reason: "Payment not received" } : {}),
      };
      if (action === "approve") {
        await settlementService.approveSettlement(payload);
        toast.success("Settlement approved and balances updated!");
      } else if (action === "reject") {
        await settlementService.rejectSettlement(payload);
        toast.success("Settlement request declined.");
      } else {
        await settlementService.cancelSettlement(payload);
        toast.success("Pending settlement request cancelled.");
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast.error(err.message || `Failed to ${action} settlement.`);
    } finally {
      setProcessingSettlementId(null);
    }
  };

  return (
    <PageContainer
      title={`${group.name} - Settlements`}
      description="Record, reconcile, and view group debt settlement transfers."
      action={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex items-center gap-1.5"
            onClick={() => navigate(`/groups/${groupId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          {!isArchived && (
            <GradientButton
              size="sm"
              className="flex items-center gap-1.5"
              onClick={() => navigate(`/groups/${groupId}/settlements/new`)}
            >
              <HandCoins className="h-4 w-4" />
              Record Repayment
            </GradientButton>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Suggested Settlement Plans Panel */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {actionablePending.length > 0 && (
            <GlassPanel variant="standard" className="p-4 flex flex-col gap-3 border border-warning/25 bg-warning/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-warning uppercase tracking-wider">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>Pending Settlement Approvals ({actionablePending.length})</span>
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                {actionablePending.map((set) => {
                  const canApprove = canApproveOrRejectSettlement(set, user?.uid, currentUserRole, members);
                  const canCancel = canCancelPendingSettlement(set, user?.uid, currentUserRole, members);
                  const isBusy = processingSettlementId?.startsWith(`${set.id}_`);

                  return (
                    <div
                      key={set.id}
                      className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-semibold text-text-primary flex-wrap">
                          <span>{getMemberName(set.payerId)}</span>
                          <ArrowLeftRight className="h-3 w-3 text-text-muted shrink-0" />
                          <span>{getMemberName(set.receiverId)}</span>
                          <span className="font-bold text-accent-cyan financial-number ml-1">
                            {formatCurrency(set.amountMinor, set.currency)}
                          </span>
                        </div>
                        {set.paymentReference && (
                          <p className="text-[11px] text-text-secondary mt-1 truncate">
                            Ref: {set.paymentReference}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {canApprove && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2.5 text-[11px] text-danger hover:bg-danger/10"
                              disabled={!syncStatus.isOnline || !!isBusy}
                              onClick={() => handleQuickAction(set, "reject")}
                            >
                              <X className="h-3.5 w-3.5 mr-1" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              variant="gradient"
                              className="h-7 px-2.5 text-[11px]"
                              disabled={!syncStatus.isOnline || !!isBusy}
                              onClick={() => handleQuickAction(set, "approve")}
                            >
                              <Check className="h-3.5 w-3.5 mr-1" />
                              Approve
                            </Button>
                          </>
                        )}
                        {canCancel && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 px-2.5 text-[11px]"
                            disabled={!syncStatus.isOnline || !!isBusy}
                            onClick={() => handleQuickAction(set, "cancel")}
                          >
                            Cancel Request
                          </Button>
                        )}
                        <Link to={`/groups/${groupId}/settlements/${set.id}`}>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]">
                            Details
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </GlassPanel>
          )}

          <DebtSimplificationPanel
            groupId={groupId!}
            expenses={expenses}
            settlements={settlements}
            members={members}
            baseCurrency={group.baseCurrency}
            settlementStrategy={group.settlementStrategy || "preserve_relationships"}
            canManageSettings={canManage}
          />
        </div>

        {/* Settlements History Log */}
        <div className="flex flex-col gap-4">
          {syncStatus.pendingCount > 0 && (
            <GlassPanel variant="subtle" className="p-3 flex items-center justify-between border border-warning/20 bg-warning/5 text-warning rounded-xl">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-warning shrink-0" />
                <div className="text-xs">
                  <span className="font-bold text-text-primary">Sync status</span>
                  <p className="text-text-muted mt-0.5">
                    {syncStatus.pendingCount} pending updates.
                  </p>
                </div>
              </div>
            </GlassPanel>
          )}
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-accent-indigo" />
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                Settlement History
              </h3>
            </div>
            <select
              value={settlementFilter}
              onChange={(e) => setSettlementFilter(e.target.value as "me" | "all")}
              className="bg-white/[0.02] border border-white/10 rounded-lg px-2 py-1 text-xs text-text-secondary focus:outline-none focus:border-accent-cyan transition-colors"
            >
              <option value="me">Involving Me</option>
              <option value="all">All Settlements</option>
            </select>
          </div>

          <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-1">
            {(() => {
              const currentMember = members.find((m) => m.userId === user?.uid || m.id === user?.uid);
              const userMemberId = currentMember?.id || user?.uid || "";

              const displayedSettlements = settlements.filter((set) => {
                if (settlementFilter === "me" && (userMemberId || user?.uid)) {
                  return (
                    set.payerId === userMemberId ||
                    set.receiverId === userMemberId ||
                    (user?.uid && (set.payerId === user.uid || set.receiverId === user.uid))
                  );
                }
                return true;
              });

              if (displayedSettlements.length === 0) {
                return (
                  <div className="p-6 text-center bg-white/5 border border-white/5 rounded-xl">
                    <p className="text-xs text-text-muted">
                      {settlementFilter === "me"
                        ? "No settlements involving you recorded yet."
                        : "No settlements recorded yet."}
                    </p>
                  </div>
                );
              }

              return displayedSettlements.map((set) => {
                const statusMeta = getSettlementStatusMeta(set.status);
                return (
                <Link
                  key={set.id}
                  to={`/groups/${groupId}/settlements/${set.id}`}
                  className="block group"
                >
                  <GlassPanel
                    variant="subtle"
                    className="p-4 flex items-center justify-between gap-3 text-xs hover:bg-white/10 transition-colors border border-white/5 group-hover:border-white/10"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-semibold text-text-primary">
                        <span className="truncate max-w-[80px] sm:max-w-[120px]">{getMemberName(set.payerId)}</span>
                        <ArrowLeftRight className="h-3 w-3 text-text-muted shrink-0" />
                        <span className="truncate max-w-[80px] sm:max-w-[120px]">{getMemberName(set.receiverId)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-text-muted">
                        <span>
                          {set.currency !== group.baseCurrency
                            ? formatCurrency(set.amountMinor, set.currency)
                            : "Direct Transfer"}
                        </span>
                        <span>•</span>
                        <span>{formatTimestamp(set.createdAt)}</span>
                      </div>
                      {set.paymentReference && (
                        <div className="text-[10px] text-accent-cyan/90 mt-1 truncate max-w-[220px]">
                          Ref: {set.paymentReference}
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 flex items-center gap-3">
                      <div>
                        <span className="font-bold text-text-primary financial-number">
                          {formatCurrency(set.baseAmountMinor, group.baseCurrency)}
                        </span>
                        <div className="mt-0.5 flex justify-end">
                          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${statusMeta.badgeClass}`}>
                            {statusMeta.label}
                          </span>
                        </div>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-text-muted group-hover:text-text-primary transition-colors" />
                    </div>
                  </GlassPanel>
                </Link>
                );
              });
            })()}
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default SettlementsPage;
