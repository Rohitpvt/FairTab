/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { PageContainer } from "../../components/layout/PageContainer";
import { groupService } from "../../infrastructure/firebase/groupService";
import type { GroupDocument } from "../groups/groupSchema";
import type { GroupMemberDocument } from "../groups/memberSchema";
import { expenseService } from "../../infrastructure/firebase/expenseService";
import type { ExpenseDocument } from "@fairtab/domain";
import ExpenseForm from "./ExpenseForm";
import type { ExpenseFormData } from "./ExpenseForm";
import { syncManager } from "../../infrastructure/offline/syncManager";
import { toast } from "sonner";
import { Skeleton } from "../../components/ui/Skeleton";

export const EditExpenseFlow: React.FC = () => {
  const { groupId, expenseId } = useParams<{ groupId: string; expenseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const localDraft = location.state?.localDraft;

  const [group, setGroup] = useState<GroupDocument | null>(null);
  const [members, setMembers] = useState<GroupMemberDocument[]>([]);
  const [expense, setExpense] = useState<ExpenseDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    return () => {
      unsubGroup();
      unsubMembers();
      unsubExpense();
    };
  }, [groupId, expenseId]);

  const handleSubmit = async (formData: ExpenseFormData) => {
    if (!group || !groupId || !expense || !expenseId) return;
    setIsSubmitting(true);

    try {
      const clientOperationId = crypto.randomUUID();

      const payload = {
        clientOperationId,
        groupId,
        expenseId,
        expectedVersion: expense.version,
        title: formData.title,
        notes: formData.notes || undefined,
        category: formData.category,
        incurredAtSeconds: formData.incurredAtSeconds,
        currency: formData.currency,
        amountMinor: formData.amountMinor,
        fxNumerator: formData.fxNumerator,
        fxDenominator: formData.fxDenominator,
        splitMethod: formData.splitMethod,
        payers: formData.payers.map((p) => ({
          memberId: p.memberId,
          amountMinor: p.amountMinor,
        })),
        splits: formData.splits.map((s) => ({
          memberId: s.memberId,
          amountMinor: s.amountMinor,
          percentageBps: s.percentageBps,
          shares: s.shares,
        })),
      };

      await syncManager.queueUpdateExpense(groupId, payload);
      toast.success("Expense update enqueued!", {
        description: "Operation enqueued for foreground synchronization.",
      });
      navigate(`/groups/${groupId}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit update.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <PageContainer title="Edit Expense" description="Loading transaction ledger...">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </PageContainer>
    );
  }

  if (!group || !expense) {
    return (
      <PageContainer title="Error" description="Group or expense not found.">
        <div className="text-center py-10">Expense not found or group is inaccessible.</div>
      </PageContainer>
    );
  }

  const initialFormData: Partial<ExpenseFormData> = localDraft
    ? {
        title: localDraft.title,
        category: localDraft.category,
        currency: localDraft.currency,
        amountMinor: localDraft.amountMinor,
        incurredAtSeconds: localDraft.incurredAtSeconds,
        notes: localDraft.notes || "",
        fxNumerator: localDraft.fxNumerator || 1,
        fxDenominator: localDraft.fxDenominator || 1,
        splitMethod: localDraft.splitMethod,
        payers: localDraft.payers,
        splits: localDraft.splits,
        participantIds: localDraft.splits.map((s: any) => s.memberId),
      }
    : {
        title: expense.title,
        category: expense.category,
        currency: expense.currency,
        amountMinor: expense.amountMinor,
        incurredAtSeconds: expense.incurredAt?.seconds || 0,
        notes: expense.notes || "",
        fxNumerator: expense.fx?.numerator || 1,
        fxDenominator: expense.fx?.denominator || 1,
        splitMethod: expense.splitMethod,
        payers: expense.payers,
        splits: expense.splits,
        participantIds: expense.splits.map((s) => s.memberId),
      };

  return (
    <PageContainer
      title="Edit Expense"
      description={`Update transaction details for "${expense.title}".`}
    >
      <div className="max-w-2xl mx-auto glass-elevated border border-white/10 rounded-2xl p-6">
        <ExpenseForm
          members={members}
          baseCurrency={group.baseCurrency}
          initialData={initialFormData}
          onSubmit={handleSubmit}
          submitLabel="Save Changes"
          isSubmitting={isSubmitting}
        />
      </div>
    </PageContainer>
  );
};

export default EditExpenseFlow;
