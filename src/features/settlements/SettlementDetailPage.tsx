import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, HandCoins, AlertTriangle, History, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PageContainer } from "../../components/layout/PageContainer";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialogs";
import { groupService } from "../../infrastructure/firebase/groupService";
import { settlementService } from "../../infrastructure/firebase/settlementService";
import { syncManager } from "../../infrastructure/offline/syncManager";
import { auth } from "../../infrastructure/firebase/firebase";
import { formatCurrency } from "../../utils/format";
import type { GroupDocument } from "../groups/groupSchema";
import type { GroupMemberDocument } from "../groups/memberSchema";
import type { SettlementDocument, SettlementRevision } from "@fairtab/domain";
import { useMemberNameResolver } from "../../hooks/useMemberNameResolver";

export const SettlementDetailPage: React.FC = () => {
  const { groupId, settlementId } = useParams<{ groupId: string; settlementId: string }>();
  const navigate = useNavigate();

  const [group, setGroup] = useState<GroupDocument | null>(null);
  const [members, setMembers] = useState<GroupMemberDocument[]>([]);
  const [settlement, setSettlement] = useState<SettlementDocument | null>(null);
  const [revisions, setRevisions] = useState<SettlementRevision[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog State
  const [isVoidOpen, setIsVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOffline = !navigator.onLine;
  const { resolveName } = useMemberNameResolver(members);

  useEffect(() => {
    if (!groupId || !settlementId) return;

    const unsubscribeGroup = groupService.watchGroup(groupId, (data) => {
      setGroup(data);
    });

    const unsubscribeMembers = groupService.watchMembers(groupId, (data) => {
      setMembers(data);
    });

    const unsubscribeSettlement = settlementService.watchSettlement(groupId, settlementId, (data) => {
      setSettlement(data);
      setIsLoading(false);
    });

    const unsubscribeRevisions = settlementService.watchRevisions(groupId, settlementId, (data) => {
      setRevisions(data);
    });

    return () => {
      unsubscribeGroup();
      unsubscribeMembers();
      unsubscribeSettlement();
      unsubscribeRevisions();
    };
  }, [groupId, settlementId]);

  if (isLoading) {
    return (
      <PageContainer title="Settlement Details" description="Loading payment records...">
        <div className="h-[250px] bg-surface-elevated animate-pulse rounded-xl" />
      </PageContainer>
    );
  }

  if (!group || !settlement) {
    return (
      <PageContainer title="Settlement Not Found" description="The requested repayment record does not exist.">
        <Button variant="secondary" onClick={() => navigate(`/groups/${groupId}/settlements`)}>
          Back to Settlements
        </Button>
      </PageContainer>
    );
  }



  const getMemberName = (id: string) => {
    const m = members.find((member) => member.id === id);
    if (!m) return id;
    return resolveName(m) + (m.kind === "placeholder" ? " (Placeholder)" : "");
  };

  const activeMembers = members.filter((m) => m.status === "active");
  const currentUserMember = activeMembers.find((m) => m.userId === auth.currentUser?.uid);
  const currentUserRole = currentUserMember?.role || "viewer";

  const payerMember = activeMembers.find((m) => m.id === settlement.payerId);
  const receiverMember = activeMembers.find((m) => m.id === settlement.receiverId);

  const isPayerPlaceholder = payerMember?.kind === "placeholder";
  const isReceiverPlaceholder = receiverMember?.kind === "placeholder";
  const isPlaceholderInvolved = isPayerPlaceholder || isReceiverPlaceholder;

  const isOwnerOrAdmin = currentUserRole === "owner" || currentUserRole === "admin";
  const isViewer = currentUserRole === "viewer";

  // Voiding Permission Check:
  // 1. Viewers cannot void
  // 2. Placeholder involved: only Admin/Owner can void
  // 3. Non-placeholder: Admin/Owner can void any. Normal member can only void if:
  //    - They created it (createdBy === auth.uid)
  //    AND
  //    - They are involved in it (payer.userId === auth.uid or receiver.userId === auth.uid)
  let canVoid = false;
  if (!isViewer && settlement.status === "active") {
    if (isOwnerOrAdmin) {
      canVoid = true;
    } else if (!isPlaceholderInvolved) {
      const isCreator = settlement.createdBy === auth.currentUser?.uid;
      const isParticipant =
        (payerMember && payerMember.userId === auth.currentUser?.uid) ||
        (receiverMember && receiverMember.userId === auth.currentUser?.uid);

      if (isCreator && isParticipant) {
        canVoid = true;
      }
    }
  }

  const handleVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canVoid) {
      toast.error("You do not have permission to void this settlement.");
      return;
    }

    setIsSubmitting(true);
    const clientOperationId = `op-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)}`;

    const payload = {
      clientOperationId,
      groupId,
      settlementId,
      expectedVersion: settlement.version,
      voidReason: voidReason.trim() || "Voided from client interface",
    };

    try {
      await syncManager.queueVoidSettlement(groupId!, payload);
      toast.success(
        isOffline
          ? "Void operation queued in outbox. It will sync automatically when online!"
          : "Settlement voided successfully!"
      );
      setIsVoidOpen(false);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(err);
      toast.error(err.message || "Failed to void settlement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isVoided = settlement.status === "voided";

  return (
    <PageContainer
      title="Settlement Record"
      description="Detailed ledger audit trail and revision log."
    >
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-1.5"
            onClick={() => navigate(`/groups/${groupId}/settlements`)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          {canVoid && (
            <Button
              variant="danger"
              size="sm"
              className="flex items-center gap-1.5"
              onClick={() => setIsVoidOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Void Settlement
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Details Panel */}
          <div className="md:col-span-2 flex flex-col gap-6">
            <GlassPanel variant="standard" className="flex flex-col gap-6">
              <div className="flex items-center gap-3 border-b border-white/5 pb-3 justify-between">
                <div className="flex items-center gap-2">
                  <HandCoins className="h-5 w-5 text-accent-cyan" />
                  <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                    Settlement Details
                  </h3>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-text-muted">Version:</span>
                  <span className="text-[10px] font-bold text-text-primary bg-white/10 px-1.5 py-0.5 rounded">
                    {settlement.version}
                  </span>
                </div>
              </div>

              {/* Status Banner */}
              {isVoided ? (
                <div className="p-4 rounded-lg bg-danger/10 border border-danger/10 text-danger text-xs flex gap-2.5">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-bold">This Settlement has been Voided</p>
                    <p className="text-text-muted mt-1">Reason: "{settlement.voidReason}"</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-success/10 border border-success/10 text-success text-xs flex gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-bold">Settlement Active and Cleared</p>
                    <p className="text-text-muted mt-1">Balances have been updated across all group members.</p>
                  </div>
                </div>
              )}

              {/* Transfers info */}
              <div className="flex flex-col gap-4 text-xs">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-text-secondary">Payer (Sender)</span>
                  <span className="font-semibold text-text-primary">{getMemberName(settlement.payerId)}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-text-secondary">Receiver (Recipient)</span>
                  <span className="font-semibold text-text-primary">{getMemberName(settlement.receiverId)}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-text-secondary">Transfer Currency</span>
                  <span className="font-semibold text-text-primary">{settlement.currency}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-text-secondary">Amount (in Currency)</span>
                  <span className="font-bold text-text-primary financial-number">
                    {formatCurrency(settlement.amountMinor, settlement.currency)}
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-text-secondary">Converted Base Amount</span>
                  <span className="font-bold text-text-primary financial-number">
                    {formatCurrency(settlement.baseAmountMinor, group.baseCurrency)}
                  </span>
                </div>
                {settlement.fx.mode !== "same_currency" && (
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-text-secondary">Exchange Rate Ratio</span>
                    <span className="font-semibold text-text-primary">
                      {settlement.fx.numerator}:{settlement.fx.denominator}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-text-secondary">Record ID</span>
                  <span className="text-[10px] font-mono text-text-muted break-all">{settlement.id}</span>
                </div>
              </div>
            </GlassPanel>
          </div>

          {/* Audit Log Panel */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-2">
              <History className="h-5 w-5 text-accent-indigo" />
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                Revision Log
              </h3>
            </div>

            <div className="flex flex-col gap-3">
              {revisions.map((rev) => (
                <GlassPanel
                  key={rev.id}
                  variant="subtle"
                  className="p-3 text-[11px] flex flex-col gap-1.5 border border-white/5"
                >
                  <div className="flex justify-between font-semibold text-text-secondary">
                    <span>Revision v{rev.version}</span>
                    <span className="text-text-muted">
                      {new Date(rev.createdAt.toDate ? rev.createdAt.toDate() : (rev.createdAt as unknown as string)).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-text-muted flex justify-between">
                    <span>Action: {rev.status === "voided" ? "Voided" : "Created"}</span>
                    <span>By: {getMemberName(rev.createdBy)}</span>
                  </div>
                  {rev.voidReason && (
                    <div className="text-[10px] text-danger mt-1 bg-danger/5 p-1.5 rounded border border-danger/10">
                      Void Reason: "{rev.voidReason}"
                    </div>
                  )}
                </GlassPanel>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Void Dialog */}
      <Dialog
        isOpen={isVoidOpen}
        onOpenChange={setIsVoidOpen}
        title="Void Settlement"
        description="Are you absolutely sure you want to void this settlement? This action will reverse all credit/debt adjustments."
        footer={
          <div className="flex gap-2 w-full justify-end">
            <Button variant="ghost" onClick={() => setIsVoidOpen(false)} disabled={isSubmitting} size="sm">
              Cancel
            </Button>
            <Button variant="danger" onClick={handleVoid} disabled={isSubmitting} size="sm">
              {isSubmitting ? "Voiding..." : "Confirm Void"}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleVoid} className="flex flex-col gap-3.5 mt-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="void-reason" className="text-xs font-semibold text-text-secondary">
              Reason for Voiding *
            </label>
            <input
              id="void-reason"
              type="text"
              required
              placeholder="e.g. Accidental transfer duplication"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              className="px-3.5 py-2.5 bg-surface-primary border border-white/10 rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-cyan"
            />
          </div>
        </form>
      </Dialog>
    </PageContainer>
  );
};

export default SettlementDetailPage;
