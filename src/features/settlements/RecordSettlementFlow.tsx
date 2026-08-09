import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, HandCoins, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import { PageContainer } from "../../components/layout/PageContainer";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Button, GradientButton } from "../../components/ui/Button";
import { groupService } from "../../infrastructure/firebase/groupService";
import { expenseService } from "../../infrastructure/firebase/expenseService";
import { settlementService } from "../../infrastructure/firebase/settlementService";
import { syncManager } from "../../infrastructure/offline/syncManager";
import { auth } from "../../infrastructure/firebase/firebase";
import { formatCurrency } from "../../utils/format";
import {
  simplifyPreserveRelationships,
} from "@fairtab/domain";
import type { ExpenseDocument, SettlementDocument } from "@fairtab/domain";
import type { GroupDocument } from "../groups/groupSchema";
import type { GroupMemberDocument } from "../groups/memberSchema";

function generateRandomId(prefix: string): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).substring(2)}`;
}

export const RecordSettlementFlow: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [group, setGroup] = useState<GroupDocument | null>(null);
  const [members, setMembers] = useState<GroupMemberDocument[]>([]);
  const [expenses, setExpenses] = useState<ExpenseDocument[]>([]);
  const [settlements, setSettlements] = useState<SettlementDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Parse prefill parameters from search query
  const searchParams = new URLSearchParams(location.search);
  const prefillFrom = searchParams.get("from") || "";
  const prefillTo = searchParams.get("to") || "";
  const prefillAmount = searchParams.get("amount") || "";

  // Form State
  const [payerId, setPayerId] = useState(prefillFrom);
  const [receiverId, setReceiverId] = useState(prefillTo);
  const [amount, setAmount] = useState(prefillAmount);
  const [currency, setCurrency] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Overpayment State
  const [confirmOverpayment, setConfirmOverpayment] = useState(false);

  useEffect(() => {
    if (!groupId) return;

    const unsubscribeGroup = groupService.watchGroup(groupId, (data) => {
      setGroup(data);
      if (data && !currency) {
        setCurrency(data.baseCurrency);
      }
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

    return () => {
      unsubscribeGroup();
      unsubscribeMembers();
      unsubscribeExpenses();
      unsubscribeSettlements();
    };
  }, [groupId, currency]);

  // Sync state selectors when loaded
  useEffect(() => {
    if (members.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!payerId) setPayerId(members[0].id);
      if (!receiverId) setReceiverId(members.length > 1 ? members[1].id : members[0].id);
    }
  }, [members, payerId, receiverId]);

  if (isLoading || !group) {
    return (
      <PageContainer title="Record Repayment" description="Loading group settings...">
        <div className="h-[300px] bg-surface-elevated animate-pulse rounded-xl" />
      </PageContainer>
    );
  }

  const activeMembers = members.filter((m) => m.status === "active");
  const currentUserMember = activeMembers.find((m) => m.userId === auth.currentUser?.uid);
  const currentUserRole = currentUserMember?.role || "viewer";

  const payerMember = activeMembers.find((m) => m.id === payerId);
  const receiverMember = activeMembers.find((m) => m.id === receiverId);

  const isPayerPlaceholder = payerMember?.kind === "placeholder";
  const isReceiverPlaceholder = receiverMember?.kind === "placeholder";
  const isInvolvedInPlaceholder = isPayerPlaceholder || isReceiverPlaceholder;

  const isOwnerOrAdmin = currentUserRole === "owner" || currentUserRole === "admin";
  const isViewer = currentUserRole === "viewer";

  // Permission Checks:
  // 1. Viewers cannot record
  // 2. Normal member cannot record settlements involving placeholders
  // 3. Normal member can only record settlements involving themselves
  let permissionError = "";
  if (group.status === "archived") {
    permissionError = "This Group is Archived and read-only.";
  } else if (group.status === "deleted") {
    permissionError = "This Group is read-only (archived or deleted).";
  } else if (isViewer) {
    permissionError = "Viewers are read-only and cannot record repayments.";
  } else if (isInvolvedInPlaceholder && !isOwnerOrAdmin) {
    permissionError = "Only group Owners or Admins can record settlements involving placeholders.";
  } else if (!isOwnerOrAdmin && payerMember && receiverMember) {
    const isPayerSelf = payerMember.userId === auth.currentUser?.uid;
    const isReceiverSelf = receiverMember.userId === auth.currentUser?.uid;
    if (!isPayerSelf && !isReceiverSelf) {
      permissionError = "A normal member can only record settlements involving themselves.";
    }
  }

  const isOffline = !navigator.onLine;

  // Calculate current suggested debt from Payer to Receiver
  let suggestedDebtMinor = 0;
  if (payerId && receiverId && payerId !== receiverId) {
    const memberIds = activeMembers.map((m) => m.id);
    const recs = simplifyPreserveRelationships(expenses, settlements, memberIds);
    const directRec = recs.find((r) => r.fromMemberId === payerId && r.toMemberId === receiverId);
    if (directRec) {
      suggestedDebtMinor = directRec.amountMinor;
    }
  }

  const amountMinor = Math.round(parseFloat(amount || "0") * 100);
  const isOverpayment = amountMinor > suggestedDebtMinor;

  const handleRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (permissionError) {
      toast.error(permissionError);
      return;
    }

    if (!payerId || !receiverId || payerId === receiverId) {
      toast.error("Please select two distinct group members.");
      return;
    }

    if (!amount || amountMinor <= 0) {
      toast.error("Please enter a valid positive repayment amount.");
      return;
    }

    if (isOverpayment && !confirmOverpayment) {
      toast.error("Please confirm authorization for this overpayment.");
      return;
    }

    setIsSubmitting(true);
    const settlementId = generateRandomId("set");
    const clientOperationId = generateRandomId("op");

    const payload = {
      clientOperationId,
      groupId,
      settlementId,
      payerId,
      receiverId,
      amountMinor,
      currency,
      fxNumerator: 1,
      fxDenominator: 1,
    };

    try {
      await syncManager.queueCreateSettlement(groupId!, payload);
      toast.success(
        isOffline
          ? "Repayment queued in outbox. It will sync automatically when online!"
          : "Repayment recorded successfully!"
      );
      navigate(`/groups/${groupId}/settlements`);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(err);
      toast.error(err.message || "Failed to record settlement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageContainer
      title="Record Repayment"
      description="Record a reimbursement payment to clear outstanding group balances."
    >
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <div className="flex justify-start">
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-1.5"
            onClick={() => navigate(`/groups/${groupId}/settlements`)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Settlements
          </Button>
        </div>

        <GlassPanel variant="standard" className="flex flex-col gap-6">
          <form onSubmit={handleRecord} className="flex flex-col gap-5">
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <HandCoins className="h-5 w-5 text-accent-cyan" />
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                Reconciliation Details
              </h3>
            </div>

            {permissionError ? (
              <div className="p-4 rounded-lg bg-danger/10 border border-danger/10 text-danger text-xs flex gap-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <p className="font-semibold">{permissionError}</p>
              </div>
            ) : null}

            {/* Payer and Receiver Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="payer" className="text-xs font-semibold text-text-secondary">
                  Who paid? (Sender)
                </label>
                <select
                  id="payer"
                  value={payerId}
                  disabled={!!prefillFrom || isSubmitting}
                  onChange={(e) => setPayerId(e.target.value)}
                  className="px-3.5 py-2.5 bg-surface-primary border border-white/10 rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-cyan cursor-pointer disabled:opacity-50"
                >
                  {activeMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName} {m.kind === "placeholder" ? "(Placeholder)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="receiver" className="text-xs font-semibold text-text-secondary">
                  Who received? (Recipient)
                </label>
                <select
                  id="receiver"
                  value={receiverId}
                  disabled={!!prefillTo || isSubmitting}
                  onChange={(e) => setReceiverId(e.target.value)}
                  className="px-3.5 py-2.5 bg-surface-primary border border-white/10 rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-cyan cursor-pointer disabled:opacity-50"
                >
                  {activeMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName} {m.kind === "placeholder" ? "(Placeholder)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Amount and Currency */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="amount" className="text-xs font-semibold text-text-secondary">
                  Repayment Amount ({currency || group.baseCurrency}) *
                </label>
                <input
                  id="amount"
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  placeholder="e.g. 10.00"
                  value={amount}
                  disabled={isSubmitting}
                  onChange={(e) => setAmount(e.target.value)}
                  className="px-3.5 py-2.5 bg-surface-primary border border-white/10 rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-cyan financial-number"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="currency" className="text-xs font-semibold text-text-secondary">
                  Currency
                </label>
                <select
                  id="currency"
                  value={currency}
                  disabled={true} // FX is manual snapshot, simplified to base group currency for this view
                  className="px-3.5 py-2.5 bg-surface-primary border border-white/10 rounded-lg text-sm text-text-muted focus:outline-none focus:border-accent-cyan"
                >
                  <option value={group.baseCurrency}>{group.baseCurrency}</option>
                </select>
                <p className="text-[10px] text-text-muted mt-1 flex items-center gap-1">
                  <Info className="h-3 w-3 shrink-0" />
                  Repayments are recorded in group's base currency.
                </p>
              </div>
            </div>

            {/* Suggested Obligation Info */}
            {payerId && receiverId && payerId !== receiverId && (
              <div className="p-3 bg-white/5 border border-white/5 rounded-lg text-[11px] text-text-secondary">
                Suggested Debt from {payerMember?.displayName} to {receiverMember?.displayName}:{" "}
                <span className="font-bold text-text-primary">
                  {formatCurrency(suggestedDebtMinor, group.baseCurrency)}
                </span>
              </div>
            )}

            {/* Overpayment Alert and Confirmation Checkbox */}
            {isOverpayment && amountMinor > 0 && (
              <div className="p-4 rounded-lg bg-warning/10 border border-warning/15 text-warning flex flex-col gap-3">
                <div className="flex gap-2.5 text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-bold">Overpayment Warning</p>
                    <p className="text-text-muted mt-1 leading-relaxed text-[11px]">
                      The settlement amount of {formatCurrency(amountMinor, group.baseCurrency)} exceeds the current
                      direct debt of {formatCurrency(suggestedDebtMinor, group.baseCurrency)} between these members.
                      Saving this will cause {receiverMember?.displayName} to owe {payerMember?.displayName} the surplus
                      of {formatCurrency(amountMinor - suggestedDebtMinor, group.baseCurrency)}.
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer self-start select-none">
                  <input
                    type="checkbox"
                    checked={confirmOverpayment}
                    onChange={(e) => setConfirmOverpayment(e.target.checked)}
                    className="h-4 w-4 rounded border-white/10 bg-surface-primary text-accent-cyan focus:ring-accent-cyan focus:ring-opacity-25"
                  />
                  <span className="text-[11px] font-semibold text-text-primary">
                    I confirm and authorize this overpayment.
                  </span>
                </label>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-2 border-t border-white/5 pt-4">
              <Button
                variant="ghost"
                type="button"
                onClick={() => navigate(`/groups/${groupId}/settlements`)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <GradientButton
                type="submit"
                disabled={
                  isSubmitting ||
                  !!permissionError ||
                  (isOverpayment && !confirmOverpayment) ||
                  payerId === receiverId
                }
              >
                {isSubmitting ? "Recording..." : "Save Settlement"}
              </GradientButton>
            </div>
          </form>
        </GlassPanel>
      </div>
    </PageContainer>
  );
};

export default RecordSettlementFlow;
