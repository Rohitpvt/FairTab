/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { PageContainer } from "../../components/layout/PageContainer";
import { groupService } from "../../infrastructure/firebase/groupService";
import type { GroupDocument } from "../groups/groupSchema";
import type { GroupMemberDocument } from "../groups/memberSchema";
import { useMemberNameResolver } from "../../hooks/useMemberNameResolver";
import { expenseService } from "../../infrastructure/firebase/expenseService";
import type { ExpenseDocument, ExpenseRevision, ParticipantPaymentDocument } from "@fairtab/domain";
import { formatMinorUnit } from "@fairtab/domain";
import { auth } from "../../infrastructure/firebase/firebase";
import { syncManager } from "../../infrastructure/offline/syncManager";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import { toast } from "sonner";
import {
  Calendar,
  Tag,
  Trash2,
  Edit2,
  Clock,
  History,
  AlertCircle,
  Undo2,
} from "lucide-react";

export const ExpenseDetailPage: React.FC = () => {
  const { groupId, expenseId } = useParams<{ groupId: string; expenseId: string }>();
  const navigate = useNavigate();

  const [group, setGroup] = useState<GroupDocument | null>(null);
  const [members, setMembers] = useState<GroupMemberDocument[]>([]);
  const [expense, setExpense] = useState<ExpenseDocument | null>(null);
  const [revisions, setRevisions] = useState<ExpenseRevision[]>([]);
  const [payments, setPayments] = useState<ParticipantPaymentDocument[]>([]);
  const [isUpdatingPayment, setIsUpdatingPayment] = useState<Record<string, boolean>>({});
  
  const [isLoading, setIsLoading] = useState(true);
  const [isVoiding, setIsVoiding] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [showVoidPrompt, setShowVoidPrompt] = useState(false);
  const { memberNameMap } = useMemberNameResolver(members);

  useEffect(() => {
    if (!groupId || !expenseId) return;

    const unsubGroup = groupService.watchGroup(groupId, (g: GroupDocument | null) => {
      setGroup(g);
    });

    const unsubMembers = groupService.watchMembers(groupId, (m: GroupMemberDocument[]) => {
      setMembers(m);
    });

    const unsubExpense = expenseService.watchExpense(groupId, expenseId, (exp) => {
      setExpense(exp);
      setIsLoading(false);
    });

    const unsubRevisions = expenseService.watchRevisions(groupId, expenseId, (revs) => {
      setRevisions(revs);
    });

    const unsubPayments = expenseService.watchParticipantPayments(groupId, expenseId, (p) => {
      setPayments(p);
    });

    return () => {
      unsubGroup();
      unsubMembers();
      unsubExpense();
      unsubRevisions();
      unsubPayments();
    };
  }, [groupId, expenseId]);

  const togglePaymentStatus = async (memberId: string) => {
    if (!groupId || !expenseId) return;
    const isPaid = payments.some((p) => p.memberId === memberId && p.status === "paid");
    setIsUpdatingPayment((prev) => ({ ...prev, [memberId]: true }));
    try {
      const clientOperationId = crypto.randomUUID();
      const payload = {
        clientOperationId,
        groupId,
        expenseId,
        memberId,
      };
      const { fairtabApi } = await import("../../infrastructure/api/fairtabApi");
      if (isPaid) {
        await fairtabApi.settlements.unsettleSplit(payload);
        toast.success("Split payment reverted successfully.");
      } else {
        await fairtabApi.settlements.settleSplit(payload);
        toast.success("Split marked as paid successfully.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update payment status.");
    } finally {
      setIsUpdatingPayment((prev) => ({ ...prev, [memberId]: false }));
    }
  };

  const handleVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group || !groupId || !expense || !expenseId) return;
    setIsVoiding(true);

    try {
      const clientOperationId = crypto.randomUUID();
      const payload = {
        clientOperationId,
        groupId,
        expenseId,
        expectedVersion: expense.version,
        voidReason: voidReason.trim() || undefined,
      };

      await syncManager.queueVoidExpense(groupId, payload);
      toast.success("Expense voiding enqueued!", {
        description: "Operation enqueued for foreground synchronization.",
      });
      setShowVoidPrompt(false);
      navigate(`/groups/${groupId}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to void expense.");
    } finally {
      setIsVoiding(false);
    }
  };

  if (isLoading) {
    return (
      <PageContainer title="Expense details" description="Loading transaction ledger...">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </PageContainer>
    );
  }

  if (!group || !expense) {
    return (
      <PageContainer title="Error" description="Expense or group not found.">
        <div className="text-center py-10">Expense not found or group is inaccessible.</div>
      </PageContainer>
    );
  }

  const getMemberName = (id: string) => memberNameMap[id] || id;

  const isVoided = expense.status === "voided";
  const formattedIncurred = expense.incurredAt?.seconds
    ? new Date(expense.incurredAt.seconds * 1000).toLocaleDateString()
    : "Unknown Date";

  const currentUserUid = auth.currentUser?.uid;
  const currentMember = members.find((m) => m.userId === currentUserUid);
  const isAuthorized = !!(currentUserUid && (
    expense.createdBy === currentUserUid ||
    currentMember?.role === "owner" ||
    currentMember?.role === "admin"
  ));

  const totalParticipants = expense.splits.length;
  const paidPayments = payments.filter((p) => p.status === "paid");
  const paidCount = paidPayments.filter(p => expense.splits.some(s => s.memberId === p.memberId)).length;
  const totalAmount = expense.amountMinor;
  const paidAmount = expense.splits
    .filter((s) => payments.some((p) => p.memberId === s.memberId && p.status === "paid"))
    .reduce((sum, s) => sum + s.amountMinor, 0);

  const progressText = `${paidCount} of ${totalParticipants} paid • ${formatMinorUnit(paidAmount, expense.currency)} of ${formatMinorUnit(totalAmount, expense.currency)} collected`;

  return (
    <PageContainer
      title={expense.title}
      description={`Transaction details for group ${group.name}`}
      action={
        <div className="flex gap-2">
          {!isVoided && group.status === "active" && (
            <>
              <Link to={`/groups/${groupId}/expenses/${expenseId}/edit`}>
                <Button variant="secondary" size="sm" className="flex gap-1.5">
                  <Edit2 className="h-4 w-4" /> Edit
                </Button>
              </Link>
              <Button
                variant="danger"
                size="sm"
                className="flex gap-1.5"
                onClick={() => setShowVoidPrompt(true)}
              >
                <Trash2 className="h-4 w-4" /> Void
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <Undo2 className="h-4 w-4 mr-1" /> Back
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left main: Expense stats and details */}
        <div className="lg:col-span-2 flex flex-col gap-6 text-left">
          {/* Status alerts */}
          {isVoided && (
            <div className="flex items-start gap-3 p-4 bg-danger/10 border border-danger/20 rounded-2xl text-danger text-sm">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Voided Expense</span>
                <span className="text-xs text-text-secondary mt-1 block">
                  Reason: {expense.voidReason || "No explanation provided."}
                </span>
              </div>
            </div>
          )}

          {/* Core Info card */}
          <div className="glass-elevated border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
            <div className="flex justify-between items-start border-b border-white/5 pb-4">
              <div>
                <span className="text-[10px] text-text-muted uppercase tracking-wider block">Total Amount</span>
                <span className="text-3xl font-extrabold text-text-primary mt-1 block">
                  {formatMinorUnit(expense.amountMinor, expense.currency)}
                </span>
              </div>
              <span className="text-xs bg-white/5 border border-white/10 px-2.5 py-1 rounded-full font-mono capitalize">
                v{expense.version} • {expense.splitMethod}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-accent-indigo" />
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Category</span>
                  <span className="text-text-primary font-semibold capitalize">{expense.category}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-accent-cyan" />
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Date Incurred</span>
                  <span className="text-text-primary font-semibold">{formattedIncurred}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-accent-violet" />
                <div>
                  <span className="text-text-muted block text-[10px] uppercase font-bold">Logged By</span>
                  <span className="text-text-primary font-semibold">
                    {expense.createdBy === "system" ? "System" : "Group Member"}
                  </span>
                </div>
              </div>
            </div>

            {expense.notes && (
              <div className="border-t border-white/5 pt-4 text-xs">
                <span className="text-text-muted block text-[10px] uppercase font-bold mb-1">Notes</span>
                <p className="text-text-secondary italic leading-relaxed">{expense.notes}</p>
              </div>
            )}

            {/* Currency conversion snapshot if foreign currency */}
            {expense.currency !== group.baseCurrency && expense.fx && (
              <div className="border-t border-white/5 pt-4 text-xs flex justify-between text-text-secondary">
                <span>FX Conversion Snapshot:</span>
                <span className="font-bold">
                  1 {expense.currency} = {(expense.fx.numerator / expense.fx.denominator).toFixed(4)} {group.baseCurrency}
                  {" "}
                  (≈ {formatMinorUnit(expense.baseAmountMinor, group.baseCurrency)})
                </span>
              </div>
            )}
          </div>

          {/* Payers & Splits Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-elevated border border-white/10 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-text-primary mb-4 uppercase tracking-wider">Paid By</h3>
              <div className="flex flex-col gap-3">
                {expense.payers.map((p) => (
                  <div key={p.memberId} className="flex justify-between items-center text-xs">
                    <span className="text-text-secondary">{getMemberName(p.memberId)}</span>
                    <span className="text-text-primary font-bold">
                      {formatMinorUnit(p.amountMinor, expense.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-elevated border border-white/10 rounded-2xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Split Breakdown</h3>
                <span className="text-[10px] text-accent-cyan font-semibold bg-accent-cyan/10 px-2.5 py-1 rounded-full">
                  {progressText}
                </span>
              </div>
              <div className="flex flex-col gap-4">
                {expense.splits.map((s) => {
                  const payment = payments.find((p) => p.memberId === s.memberId);
                  const isPaid = payment?.status === "paid";
                  const isUpdating = !!isUpdatingPayment[s.memberId];
                  return (
                    <div key={s.memberId} className="flex justify-between items-center text-xs border-b border-white/5 pb-3 last:border-0 last:pb-0">
                      <div className="flex flex-col gap-1">
                        <span className="text-text-secondary font-medium">{getMemberName(s.memberId)}</span>
                        <div className="flex items-center gap-1.5">
                          {isPaid ? (
                            <span className="text-[10px] text-green-400 font-bold bg-green-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                              ✓ Paid
                            </span>
                          ) : (
                            <span className="text-[10px] text-text-muted bg-white/5 px-2 py-0.5 rounded-full">
                              Unpaid
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-text-primary font-bold block">
                            {formatMinorUnit(s.amountMinor, expense.currency)}
                          </span>
                          {s.percentageBps !== undefined && (
                            <span className="text-[9px] text-text-muted block">
                              {(s.percentageBps / 100).toFixed(2)}%
                            </span>
                          )}
                          {s.shares !== undefined && (
                            <span className="text-[9px] text-text-muted block">
                              {s.shares} {s.shares === 1 ? "share" : "shares"}
                            </span>
                          )}
                        </div>
                        {isAuthorized && !isVoided && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isUpdating}
                            onClick={() => togglePaymentStatus(s.memberId)}
                            className={`px-3 py-1.5 h-8 text-[10px] rounded-lg border font-semibold transition-all ${
                              isPaid
                                ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                                : "border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/10"
                            }`}
                          >
                            {isUpdating ? "..." : isPaid ? "Unmark" : "Mark Paid"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right side: Revisions trail / History */}
        <div className="glass-elevated border border-white/10 rounded-2xl p-6 text-left flex flex-col gap-4">
          <h3 className="text-sm font-bold text-text-primary flex items-center gap-2 uppercase tracking-wider border-b border-white/5 pb-2">
            <History className="h-4 w-4 text-accent-cyan" />
            Audit trail ({revisions.length})
          </h3>

          <div className="flex flex-col gap-4 overflow-y-auto max-h-[400px] pr-1">
            {revisions.map((rev) => (
              <div key={rev.id} className="relative pl-4 border-l border-white/10 flex flex-col gap-1 text-xs">
                <div className="absolute left-[-4.5px] top-1.5 w-2.5 h-2.5 rounded-full bg-accent-indigo" />
                <div className="flex justify-between text-text-primary font-semibold">
                  <span>Version {rev.version}</span>
                  <span className="font-mono">
                    {formatMinorUnit(rev.amountMinor, rev.currency)}
                  </span>
                </div>
                <div className="text-text-muted text-[10px]">
                  {rev.status === "voided" ? "Voided" : `Category: ${rev.category}`}
                  {rev.voidReason && ` (${rev.voidReason})`}
                </div>
                <div className="text-text-muted text-[9px]">
                  Updated by {rev.createdBy === "system" ? "System" : "Group Member"}
                </div>
              </div>
            ))}
            {revisions.length === 0 && (
              <span className="text-xs text-text-muted italic">No revision history logged yet.</span>
            )}
          </div>
        </div>
      </div>

      {/* Void Dialog prompt */}
      {showVoidPrompt && (
        <div className="fixed inset-0 bg-background-primary/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-primary border border-white/10 rounded-2xl p-6 max-w-md w-full text-left flex flex-col gap-4 shadow-2xl">
            <h3 className="text-base font-bold text-text-primary">Void Expense</h3>
            <p className="text-xs text-text-secondary">
              Voiding will set this transaction status to read-only and remove its balance effect from group splits.
            </p>

            <form onSubmit={handleVoid} className="flex flex-col gap-4">
              <label className="text-xs font-semibold text-text-secondary">
                Void Reason (optional)
                <input
                  type="text"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="e.g. Accidental log / double entry"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 mt-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-cyan"
                  maxLength={200}
                />
              </label>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  variant="danger"
                  isLoading={isVoiding}
                  loadingText="Voiding..."
                  className="flex-1"
                >
                  Void Expense
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowVoidPrompt(false)}
                  disabled={isVoiding}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

export default ExpenseDetailPage;
