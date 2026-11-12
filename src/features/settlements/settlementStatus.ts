import type { SettlementDocument, SettlementStatus } from "@fairtab/domain";
import type { GroupMemberDocument } from "../groups/memberSchema";

export interface SettlementStatusMeta {
  label: string;
  badgeClass: string;
  isSettled: boolean;
}

const STATUS_META: Record<SettlementStatus, SettlementStatusMeta> = {
  active: {
    label: "Cleared",
    badgeClass: "bg-success/10 text-success border border-success/20",
    isSettled: true,
  },
  pending_approval: {
    label: "Pending Approval",
    badgeClass: "bg-warning/10 text-warning border border-warning/20",
    isSettled: false,
  },
  rejected: {
    label: "Rejected",
    badgeClass: "bg-danger/10 text-danger border border-danger/20",
    isSettled: false,
  },
  cancelled: {
    label: "Cancelled",
    badgeClass: "bg-white/5 text-text-muted border border-white/10",
    isSettled: false,
  },
  voided: {
    label: "Voided",
    badgeClass: "bg-danger/10 text-danger border border-danger/20",
    isSettled: false,
  },
};

export function getSettlementStatusMeta(status: SettlementStatus): SettlementStatusMeta {
  return STATUS_META[status] || STATUS_META.active;
}

export function canApproveOrRejectSettlement(
  settlement: Pick<SettlementDocument, "status" | "receiverId">,
  currentUid: string | undefined,
  currentUserRole: string,
  members: GroupMemberDocument[]
): boolean {
  if (!currentUid || settlement.status !== "pending_approval" || currentUserRole === "viewer") {
    return false;
  }
  const receiver = members.find((m) => m.id === settlement.receiverId);
  if (receiver?.kind === "placeholder") {
    return currentUserRole === "owner" || currentUserRole === "admin";
  }
  return Boolean(receiver && receiver.status === "active" && receiver.userId === currentUid);
}

export function canCancelPendingSettlement(
  settlement: Pick<SettlementDocument, "status" | "payerId" | "createdBy">,
  currentUid: string | undefined,
  currentUserRole: string,
  members: GroupMemberDocument[]
): boolean {
  if (!currentUid || settlement.status !== "pending_approval" || currentUserRole === "viewer") {
    return false;
  }
  if (settlement.createdBy === currentUid) {
    return true;
  }
  const payer = members.find((m) => m.id === settlement.payerId);
  if (payer?.kind === "placeholder") {
    return currentUserRole === "owner" || currentUserRole === "admin";
  }
  return Boolean(payer && payer.userId === currentUid);
}

export function canVoidActiveSettlement(
  settlement: Pick<SettlementDocument, "status" | "payerId" | "receiverId" | "createdBy" | "approvedBy">,
  currentUid: string | undefined,
  currentUserRole: string,
  members: GroupMemberDocument[]
): boolean {
  if (!currentUid || settlement.status !== "active" || currentUserRole === "viewer") {
    return false;
  }
  const isOwnerOrAdmin = currentUserRole === "owner" || currentUserRole === "admin";
  const payer = members.find((m) => m.id === settlement.payerId);
  const receiver = members.find((m) => m.id === settlement.receiverId);

  if (payer?.kind === "placeholder" || receiver?.kind === "placeholder") {
    return isOwnerOrAdmin;
  }

  const isParticipant =
    Boolean(payer && payer.userId === currentUid) ||
    Boolean(receiver && receiver.userId === currentUid);
  const isCreatorOrApprover =
    settlement.createdBy === currentUid || settlement.approvedBy === currentUid;

  return isParticipant && isCreatorOrApprover;
}
