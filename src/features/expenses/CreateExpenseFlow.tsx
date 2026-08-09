/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageContainer } from "../../components/layout/PageContainer";
import { groupService } from "../../infrastructure/firebase/groupService";
import type { GroupDocument } from "../groups/groupSchema";
import type { GroupMemberDocument } from "../groups/memberSchema";
import ExpenseForm from "./ExpenseForm";
import type { ExpenseFormData } from "./ExpenseForm";
import { syncManager } from "../../infrastructure/offline/syncManager";
import { toast } from "sonner";
import { Skeleton } from "../../components/ui/Skeleton";

export const CreateExpenseFlow: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();

  const [group, setGroup] = useState<GroupDocument | null>(null);
  const [members, setMembers] = useState<GroupMemberDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!groupId) return;

    const unsubGroup = groupService.watchGroup(groupId, (g: GroupDocument | null) => {
      setGroup(g);
      setIsLoading(false);
    });

    const unsubMembers = groupService.watchMembers(groupId, (m: GroupMemberDocument[]) => {
      setMembers(m);
    });

    return () => {
      unsubGroup();
      unsubMembers();
    };
  }, [groupId]);

  const handleSubmit = async (formData: ExpenseFormData) => {
    if (!group || !groupId) return;
    setIsSubmitting(true);

    try {
      const clientOperationId = crypto.randomUUID();
      const expenseId = crypto.randomUUID();

      const payload = {
        clientOperationId,
        groupId,
        expenseId,
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

      await syncManager.queueCreateExpense(groupId, payload);
      toast.success("Expense added successfully!", {
        description: "Operation enqueued for foreground synchronization.",
      });
      navigate(`/groups/${groupId}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit expense.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <PageContainer title="Add Expense" description="Loading group ledger...">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </PageContainer>
    );
  }

  if (!group) {
    return (
      <PageContainer title="Error" description="Group not found or inaccessible.">
        <div className="text-center py-10">Group not found.</div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Add Expense"
      description={`Record a shared transaction for group ${group.name}.`}
    >
      <div className="max-w-2xl mx-auto glass-elevated border border-white/10 rounded-2xl p-6">
        <ExpenseForm
          members={members}
          baseCurrency={group.baseCurrency}
          onSubmit={handleSubmit}
          submitLabel="Create Expense"
          isSubmitting={isSubmitting}
        />
      </div>
    </PageContainer>
  );
};

export default CreateExpenseFlow;
