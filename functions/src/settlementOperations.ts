/* eslint-disable @typescript-eslint/no-explicit-any */
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  splitProportional,
  getCurrencyMetadata,
} from "@fairtab/domain";
import type {
  SettlementDocument,
  SettlementRevision,
  SettlementOperationReceipt,
  SettlementStatus,
} from "@fairtab/domain";
import { computePayloadHash } from "./expenseOperations.js";

const MAX_PAYMENT_REFERENCE_LENGTH = 200;

interface CreateSettlementInput {
  clientOperationId: string;
  groupId: string;
  settlementId: string;
  payerId: string; // memberId
  receiverId: string; // memberId
  amountMinor: number;
  currency: string;
  fxNumerator: number;
  fxDenominator: number;
  paymentReference?: string;
}

interface ResolveSettlementInput {
  clientOperationId: string;
  groupId: string;
  settlementId: string;
  expectedVersion: number;
  reason?: string;
}

interface VoidSettlementInput {
  clientOperationId: string;
  groupId: string;
  settlementId: string;
  expectedVersion: number;
  voidReason?: string;
}

function normalizePaymentReference(raw?: unknown): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Payment reference note must be a string."
    );
  }
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > MAX_PAYMENT_REFERENCE_LENGTH) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `Payment reference note cannot exceed ${MAX_PAYMENT_REFERENCE_LENGTH} characters.`
    );
  }
  return trimmed;
}

function formatSettlementAmount(amountMinor: number, currency: string): string {
  const meta = getCurrencyMetadata(currency);
  const factor = Math.pow(10, meta.minorUnit);
  return `${(amountMinor / factor).toFixed(meta.minorUnit)} ${currency}`;
}

function shouldAutoApproveForReceiver(
  actorUid: string,
  actorRole: string,
  receiverDoc: FirebaseFirestore.DocumentData
): boolean {
  const isOwnerOrAdmin = actorRole === "owner" || actorRole === "admin";
  if (receiverDoc.kind === "placeholder") {
    return isOwnerOrAdmin;
  }
  return receiverDoc.userId === actorUid;
}

function assertCanApproveOrRejectSettlement(
  actorUid: string,
  actorRole: string,
  receiverDoc: FirebaseFirestore.DocumentData | null
): void {
  const isOwnerOrAdmin = actorRole === "owner" || actorRole === "admin";
  if (receiverDoc?.kind === "placeholder") {
    if (!isOwnerOrAdmin) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only group Owners or Admins can approve or reject settlements for placeholder recipients."
      );
    }
    return;
  }

  if (!receiverDoc || receiverDoc.status !== "active" || receiverDoc.userId !== actorUid) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only the recipient of this settlement can approve or reject it."
    );
  }
}

function assertCanCancelPendingSettlement(
  actorUid: string,
  actorRole: string,
  settlement: SettlementDocument,
  payerDoc: FirebaseFirestore.DocumentData | null
): void {
  const isOwnerOrAdmin = actorRole === "owner" || actorRole === "admin";
  if (settlement.createdBy === actorUid) return;
  if (payerDoc?.kind === "placeholder") {
    if (isOwnerOrAdmin) return;
  } else if (payerDoc?.userId === actorUid) {
    return;
  }

  throw new functions.https.HttpsError(
    "permission-denied",
    "Only the settlement creator or payer can cancel this pending request."
  );
}

function assertCanVoidActiveSettlement(
  actorUid: string,
  actorRole: string,
  settlement: SettlementDocument,
  payerDoc: FirebaseFirestore.DocumentData | null,
  receiverDoc: FirebaseFirestore.DocumentData | null
): void {
  const isOwnerOrAdmin = actorRole === "owner" || actorRole === "admin";
  const isPayerPlaceholder = payerDoc?.kind === "placeholder";
  const isReceiverPlaceholder = receiverDoc?.kind === "placeholder";

  if (isPayerPlaceholder || isReceiverPlaceholder) {
    if (!isOwnerOrAdmin) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only Owner/Admin can void settlements involving placeholders."
      );
    }
    return;
  }

  // Strictly apply to everyone including Owner/Admin when real users are involved:
  const isParticipant =
    (payerDoc && payerDoc.userId === actorUid) ||
    (receiverDoc && receiverDoc.userId === actorUid);
  const isCreatorOrApprover =
    settlement.createdBy === actorUid || settlement.approvedBy === actorUid;

  if (!isParticipant || !isCreatorOrApprover) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only an involved creator or confirming recipient can void this settlement."
    );
  }
}

function notificationDocIdForSettlement(settlementId: string): string {
  return `settlement_${settlementId}`;
}

async function syncLinkedPaymentStatusInTx(
  transaction: FirebaseFirestore.Transaction,
  trackingSnap: FirebaseFirestore.DocumentSnapshot | null,
  trackingRef: FirebaseFirestore.DocumentReference | null,
  siblingSettlementSnaps: FirebaseFirestore.DocumentSnapshot[],
  updatedSettlementId: string,
  nextStatus: SettlementStatus,
  actorUid: string,
  timestamp: Timestamp
): Promise<void> {
  if (!trackingSnap || !trackingRef || !trackingSnap.exists) return;
  const trackingData = trackingSnap.data()!;
  const statuses: SettlementStatus[] = siblingSettlementSnaps.map((snap) => {
    if (snap.id === updatedSettlementId) return nextStatus;
    if (!snap.exists) return "voided";
    return (snap.data()!.status as SettlementStatus) || "voided";
  });

  const anyPending = statuses.some((s) => s === "pending_approval");
  const allActive = statuses.length > 0 && statuses.every((s) => s === "active");

  const nextPaymentStatus: "paid" | "pending_approval" | "unpaid" = allActive
    ? "paid"
    : anyPending
    ? "pending_approval"
    : "unpaid";

  transaction.set(trackingRef, {
    ...trackingData,
    status: nextPaymentStatus,
    markedBy: actorUid,
    markedAt: timestamp,
    version: (trackingData.version || 1) + 1,
  });
}

async function resolveApproverTargetUids(
  transaction: FirebaseFirestore.Transaction,
  db: FirebaseFirestore.Firestore,
  groupId: string,
  receiverDoc: FirebaseFirestore.DocumentData
): Promise<string[]> {
  if (receiverDoc.kind !== "placeholder") {
    return receiverDoc.userId ? [receiverDoc.userId] : [];
  }
  const activeMembersSnap = await transaction.get(
    db.collection(`groups/${groupId}/members`).where("status", "==", "active")
  );
  const uids: string[] = [];
  activeMembersSnap.forEach((docSnap) => {
    const m = docSnap.data();
    if ((m.role === "owner" || m.role === "admin") && m.userId) {
      uids.push(m.userId);
    }
  });
  return Array.from(new Set(uids));
}

export const handleCreateSettlement = async (
  data: CreateSettlementInput,
  context: functions.https.CallableContext
): Promise<any> => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Only authenticated users can create settlements."
    );
  }
  const actorUid = context.auth.uid;

  const {
    clientOperationId,
    groupId,
    settlementId,
    payerId,
    receiverId,
    amountMinor,
    currency,
    fxNumerator,
    fxDenominator,
    paymentReference: rawPaymentReference,
  } = data;

  if (
    !clientOperationId ||
    !groupId ||
    !settlementId ||
    !payerId ||
    !receiverId ||
    !amountMinor ||
    !currency
  ) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required fields for settlement creation."
    );
  }

  if (payerId === receiverId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Payer and receiver cannot be the same member."
    );
  }

  if (amountMinor <= 0 || !Number.isInteger(amountMinor) || amountMinor > Number.MAX_SAFE_INTEGER) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Settlement amount must be a positive integer in minor units under MAX_SAFE_INTEGER."
    );
  }

  const paymentReference = normalizePaymentReference(rawPaymentReference);

  const db = admin.firestore();
  const groupRef = db.doc(`groups/${groupId}`);
  const memberPayerRef = db.doc(`groups/${groupId}/members/${payerId}`);
  const memberReceiverRef = db.doc(`groups/${groupId}/members/${receiverId}`);
  const memberActorRef = db.doc(`groups/${groupId}/members/${actorUid}`);
  const operationRef = db.doc(`groups/${groupId}/settlementOperations/${clientOperationId}`);
  const settlementRef = db.doc(`groups/${groupId}/settlements/${settlementId}`);

  const payloadHash = computePayloadHash({
    groupId,
    settlementId,
    payerId,
    receiverId,
    amountMinor,
    currency,
    fxNumerator,
    fxDenominator,
    ...(paymentReference ? { paymentReference } : {}),
  });

  return db.runTransaction(async (transaction) => {
    // 1. Check Idempotency Receipt
    const opSnap = await transaction.get(operationRef);
    if (opSnap.exists) {
      const receipt = opSnap.data() as SettlementOperationReceipt;
      if (receipt.payloadHash !== payloadHash) {
        throw new functions.https.HttpsError(
          "already-exists",
          "An operation with this ID exists with a different payload."
        );
      }
      return receipt.result;
    }

    // 2. Fetch Group
    const groupSnap = await transaction.get(groupRef);
    if (!groupSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Group not found.");
    }
    const group = groupSnap.data()!;

    // Block write on archived or deleted groups
    if (group.status === "archived" || group.status === "deleted") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Cannot record settlements in an archived or deleted group."
      );
    }

    // 3. Fetch Actor, Payer, Receiver & check duplicate Settlement ID (all reads before writes)
    const [actorSnap, payerSnap, receiverSnap, setSnap] = await Promise.all([
      transaction.get(memberActorRef),
      transaction.get(memberPayerRef),
      transaction.get(memberReceiverRef),
      transaction.get(settlementRef),
    ]);

    if (!actorSnap.exists || actorSnap.data()!.status !== "active") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Actor is not an active member of the group."
      );
    }
    const actorDoc = actorSnap.data()!;
    const actorRole = actorDoc.role;

    if (!payerSnap.exists || payerSnap.data()!.status !== "active") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Payer is not an active member of this group."
      );
    }
    if (!receiverSnap.exists || receiverSnap.data()!.status !== "active") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Receiver is not an active member of this group."
      );
    }

    if (setSnap.exists) {
      throw new functions.https.HttpsError("already-exists", "Settlement ID already exists.");
    }

    const payerDoc = payerSnap.data()!;
    const receiverDoc = receiverSnap.data()!;

    const isPayerPlaceholder = payerDoc.kind === "placeholder";
    const isReceiverPlaceholder = receiverDoc.kind === "placeholder";
    const isOwnerOrAdmin = actorRole === "owner" || actorRole === "admin";

    if (actorRole === "viewer") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Viewers are read-only and cannot record settlements."
      );
    }

    // Payer placeholders have no account to initiate repayments; only Owner/Admin may record from them.
    if (isPayerPlaceholder && !isOwnerOrAdmin) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only Owner/Admin can record settlements involving placeholders."
      );
    }

    if (!isOwnerOrAdmin) {
      const isPayerSelf = !isPayerPlaceholder && payerDoc.userId === actorUid;
      const isReceiverSelf = !isReceiverPlaceholder && receiverDoc.userId === actorUid;
      if (!isPayerSelf && !isReceiverSelf) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "A normal member can only record settlements involving themselves."
        );
      }
    }

    // 4. FX Validation
    const groupBaseCurrency = group.baseCurrency;
    if (currency === groupBaseCurrency) {
      if (fxNumerator !== 1 || fxDenominator !== 1) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "FX exchange rate must be 1:1 for matching currencies."
        );
      }
    } else {
      if (
        fxNumerator <= 0 ||
        fxDenominator <= 0 ||
        !Number.isInteger(fxNumerator) ||
        !Number.isInteger(fxDenominator)
      ) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "FX exchange rate must be positive integers."
        );
      }
    }

    const baseAmountMinor = Math.round((amountMinor * fxNumerator) / fxDenominator);
    if (baseAmountMinor < 0 || !Number.isFinite(baseAmountMinor) || baseAmountMinor > Number.MAX_SAFE_INTEGER) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Calculated base amount overflow."
      );
    }

    // 5. Determine whether receiver (or admin/owner for placeholder receiver) auto-approves
    const autoApproved = shouldAutoApproveForReceiver(actorUid, actorRole, receiverDoc);
    const initialStatus: SettlementStatus = autoApproved ? "active" : "pending_approval";

    // Read approver targets while still in read phase if approval is required
    const approverTargetUids = autoApproved
      ? []
      : await resolveApproverTargetUids(transaction, db, groupId, receiverDoc);

    // 6. Write documents
    const timestamp = Timestamp.now();
    const settlementDoc: SettlementDocument = {
      id: settlementId,
      groupId,
      payerId,
      receiverId,
      amountMinor,
      currency,
      baseAmountMinor,
      fx: {
        mode: currency === groupBaseCurrency ? "same_currency" : "manual_snapshot",
        numerator: fxNumerator,
        denominator: fxDenominator,
      },
      status: initialStatus,
      paymentReference,
      ...(autoApproved ? { approvedAt: timestamp, approvedBy: actorUid } : {}),
      createdAt: timestamp,
      createdBy: actorUid,
      updatedAt: timestamp,
      updatedBy: actorUid,
      version: 1,
      schemaVersion: 1,
      latestOperationId: clientOperationId,
    };

    const revisionDoc: SettlementRevision = {
      id: "1",
      settlementId,
      groupId,
      payerId,
      receiverId,
      amountMinor,
      currency,
      baseAmountMinor,
      fx: settlementDoc.fx,
      status: initialStatus,
      paymentReference,
      version: 1,
      schemaVersion: 1,
      operationId: clientOperationId,
      createdAt: timestamp,
      createdBy: actorUid,
    };

    const receipt: SettlementOperationReceipt = {
      clientOperationId,
      groupId,
      type: "create",
      actorUid: actorUid,
      settlementId,
      payloadHash,
      createdAt: timestamp,
      result: {
        settlementId,
        version: 1,
        status: initialStatus,
      },
    };

    const activityId = db.collection(`groups/${groupId}/activities`).doc().id;
    const payerName = payerDoc.displayName;
    const receiverName = receiverDoc.displayName;
    const formattedAmount = formatSettlementAmount(amountMinor, currency);
    const refSuffix = paymentReference ? ` (Ref: ${paymentReference})` : "";
    const activityDoc = {
      id: activityId,
      groupId,
      type: autoApproved ? "settlement_created" : "settlement_requested",
      summary: autoApproved
        ? `${payerName} paid ${receiverName} ${formattedAmount}${refSuffix}`
        : `${payerName} requested settlement approval from ${receiverName} for ${formattedAmount}${refSuffix}`,
      actorUserId: actorUid,
      entityId: settlementId,
      createdAt: timestamp,
    };

    transaction.set(settlementRef, settlementDoc);
    transaction.set(db.doc(`groups/${groupId}/settlements/${settlementId}/revisions/1`), revisionDoc);
    transaction.set(operationRef, receipt);
    transaction.set(db.doc(`groups/${groupId}/activities/${activityId}`), activityDoc);

    if (!autoApproved) {
      const notifId = notificationDocIdForSettlement(settlementId);
      for (const targetUid of approverTargetUids) {
        if (targetUid === actorUid) continue;
        transaction.set(db.doc(`users/${targetUid}/notifications/${notifId}`), {
          id: notifId,
          type: "settlement_approval_request",
          status: "pending",
          groupId,
          groupName: group.name || "",
          settlementId,
          payerId,
          payerName,
          receiverId,
          receiverName,
          amountMinor,
          baseAmountMinor,
          currency,
          groupBaseCurrency,
          paymentReference,
          requestedByUid: actorUid,
          requestedByName: actorDoc.displayName || payerName,
          isPlaceholderReceiver: receiverDoc.kind === "placeholder",
          createdAt: timestamp,
        });
      }
    }

    // Update group latest metadata
    transaction.update(groupRef, {
      updatedAt: timestamp,
      updatedBy: actorUid,
      latestActivityAt: timestamp,
      version: FieldValue.increment(1),
    });

    return receipt.result;
  });
};

async function resolvePendingSettlement(
  data: ResolveSettlementInput,
  context: functions.https.CallableContext,
  action: "approve" | "reject" | "cancel"
): Promise<any> {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      `Only authenticated users can ${action} settlements.`
    );
  }
  const actorUid = context.auth.uid;

  const { clientOperationId, groupId, settlementId, expectedVersion, reason } = data;
  if (!clientOperationId || !groupId || !settlementId || expectedVersion === undefined) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `Missing required fields to ${action} settlement.`
    );
  }

  const trimmedReason = typeof reason === "string" ? reason.trim().slice(0, 200) : "";

  const db = admin.firestore();
  const groupRef = db.doc(`groups/${groupId}`);
  const operationRef = db.doc(`groups/${groupId}/settlementOperations/${clientOperationId}`);
  const settlementRef = db.doc(`groups/${groupId}/settlements/${settlementId}`);
  const memberActorRef = db.doc(`groups/${groupId}/members/${actorUid}`);

  const payloadHash = computePayloadHash({
    action,
    groupId,
    settlementId,
    expectedVersion,
    reason: trimmedReason,
  });

  return db.runTransaction(async (transaction) => {
    const opSnap = await transaction.get(operationRef);
    if (opSnap.exists) {
      const receipt = opSnap.data() as SettlementOperationReceipt;
      if (receipt.payloadHash !== payloadHash) {
        throw new functions.https.HttpsError(
          "already-exists",
          "An operation with this ID exists with a different payload."
        );
      }
      return receipt.result;
    }

    const groupSnap = await transaction.get(groupRef);
    if (!groupSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Group not found.");
    }
    const group = groupSnap.data()!;
    if (group.status === "archived" || group.status === "deleted") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Cannot ${action} settlements in an archived or deleted group.`
      );
    }

    const [actorSnap, setSnap] = await Promise.all([
      transaction.get(memberActorRef),
      transaction.get(settlementRef),
    ]);

    if (!actorSnap.exists || actorSnap.data()!.status !== "active") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Actor is not an active member of the group."
      );
    }
    const actorDoc = actorSnap.data()!;
    const actorRole = actorDoc.role;
    if (actorRole === "viewer") {
      throw new functions.https.HttpsError(
        "permission-denied",
        `Viewers are read-only and cannot ${action} settlements.`
      );
    }

    if (!setSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Settlement not found.");
    }
    const settlement = setSnap.data() as SettlementDocument;

    if (settlement.version !== expectedVersion) {
      throw new functions.https.HttpsError(
        "aborted",
        "Conflict: The settlement has been modified by another transaction.",
        {
          currentVersion: settlement.version,
          expectedVersion,
        }
      );
    }

    const targetStatus: SettlementStatus =
      action === "approve" ? "active" : action === "reject" ? "rejected" : "cancelled";

    if (settlement.status === targetStatus) {
      const receipt: SettlementOperationReceipt = {
        clientOperationId,
        groupId,
        type: action,
        actorUid,
        settlementId,
        payloadHash,
        createdAt: Timestamp.now(),
        result: {
          settlementId,
          version: settlement.version,
          status: settlement.status,
        },
      };
      transaction.set(operationRef, receipt);
      return receipt.result;
    }

    if (settlement.status !== "pending_approval") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Only pending settlements can be resolved (current status: ${settlement.status}).`
      );
    }

    const [payerSnap, receiverSnap] = await Promise.all([
      transaction.get(db.doc(`groups/${groupId}/members/${settlement.payerId}`)),
      transaction.get(db.doc(`groups/${groupId}/members/${settlement.receiverId}`)),
    ]);
    const payerDoc = payerSnap.exists ? payerSnap.data()! : null;
    const receiverDoc = receiverSnap.exists ? receiverSnap.data()! : null;

    if (action === "cancel") {
      assertCanCancelPendingSettlement(actorUid, actorRole, settlement, payerDoc);
    } else {
      assertCanApproveOrRejectSettlement(actorUid, actorRole, receiverDoc);
    }

    // Read any pending approval notifications + linked expense payment tracking BEFORE writes
    const notifId = notificationDocIdForSettlement(settlementId);
    const notifTargets = receiverDoc
      ? await resolveApproverTargetUids(transaction, db, groupId, receiverDoc)
      : [actorUid];
    const notifRefs = notifTargets.map((uid) => db.doc(`users/${uid}/notifications/${notifId}`));
    const notifSnaps = await Promise.all(notifRefs.map((ref) => transaction.get(ref)));

    let trackingRef: FirebaseFirestore.DocumentReference | null = null;
    let trackingSnap: FirebaseFirestore.DocumentSnapshot | null = null;
    let siblingSnaps: FirebaseFirestore.DocumentSnapshot[] = [];
    if (settlement.relatedExpenseId && settlement.relatedMemberId) {
      trackingRef = db.doc(
        `groups/${groupId}/expenses/${settlement.relatedExpenseId}/payments/${settlement.relatedMemberId}`
      );
      trackingSnap = await transaction.get(trackingRef);
      if (trackingSnap.exists) {
        const sIds: string[] = trackingSnap.data()!.settlementIds || [];
        siblingSnaps = await Promise.all(
          sIds.map((id) => transaction.get(db.doc(`groups/${groupId}/settlements/${id}`)))
        );
      }
    }

    const timestamp = Timestamp.now();
    const newVersion = settlement.version + 1;
    const resolutionFields: Partial<SettlementDocument> =
      action === "approve"
        ? { approvedAt: timestamp, approvedBy: actorUid }
        : action === "reject"
        ? {
            rejectedAt: timestamp,
            rejectedBy: actorUid,
            rejectionReason: trimmedReason || "No reason provided",
          }
        : {
            cancelledAt: timestamp,
            cancelledBy: actorUid,
          };

    const updatedSettlement: Partial<SettlementDocument> = {
      status: targetStatus,
      ...resolutionFields,
      version: newVersion,
      updatedAt: timestamp,
      updatedBy: actorUid,
      latestOperationId: clientOperationId,
    };

    const revisionDoc: SettlementRevision = {
      id: String(newVersion),
      settlementId,
      groupId,
      payerId: settlement.payerId,
      receiverId: settlement.receiverId,
      amountMinor: settlement.amountMinor,
      currency: settlement.currency,
      baseAmountMinor: settlement.baseAmountMinor,
      fx: settlement.fx,
      status: targetStatus,
      paymentReference: settlement.paymentReference,
      ...(action === "reject" ? { rejectionReason: trimmedReason || "No reason provided" } : {}),
      version: newVersion,
      schemaVersion: 1,
      operationId: clientOperationId,
      createdAt: timestamp,
      createdBy: actorUid,
      ...(settlement.relatedExpenseId ? { relatedExpenseId: settlement.relatedExpenseId } : {}),
      ...(settlement.relatedMemberId ? { relatedMemberId: settlement.relatedMemberId } : {}),
    };

    const receipt: SettlementOperationReceipt = {
      clientOperationId,
      groupId,
      type: action,
      actorUid,
      settlementId,
      payloadHash,
      createdAt: timestamp,
      result: {
        settlementId,
        version: newVersion,
        status: targetStatus,
      },
    };

    const payerName = payerDoc ? payerDoc.displayName : settlement.payerId;
    const receiverName = receiverDoc ? receiverDoc.displayName : settlement.receiverId;
    const formattedAmount = formatSettlementAmount(settlement.amountMinor, settlement.currency);
    const activityId = db.collection(`groups/${groupId}/activities`).doc().id;
    const activityType =
      action === "approve"
        ? "settlement_approved"
        : action === "reject"
        ? "settlement_rejected"
        : "settlement_cancelled";
    const summary =
      action === "approve"
        ? `${receiverName} confirmed repayment of ${formattedAmount} from ${payerName}`
        : action === "reject"
        ? `${receiverName} declined repayment request of ${formattedAmount} from ${payerName}`
        : `${payerName} cancelled pending repayment of ${formattedAmount} to ${receiverName}`;

    transaction.update(settlementRef, updatedSettlement);
    transaction.set(
      db.doc(`groups/${groupId}/settlements/${settlementId}/revisions/${newVersion}`),
      revisionDoc
    );
    transaction.set(operationRef, receipt);
    transaction.set(db.doc(`groups/${groupId}/activities/${activityId}`), {
      id: activityId,
      groupId,
      type: activityType,
      summary,
      actorUserId: actorUid,
      entityId: settlementId,
      createdAt: timestamp,
    });

    // Update pending notifications on approvers
    const notifNextStatus =
      action === "approve" ? "approved" : action === "reject" ? "declined" : "cancelled";
    notifSnaps.forEach((snap, idx) => {
      if (snap.exists) {
        transaction.update(notifRefs[idx], {
          status: notifNextStatus,
          resolvedByUid: actorUid,
          resolvedAt: timestamp,
        });
      }
    });

    // Notify requester when approver resolves
    if ((action === "approve" || action === "reject") && settlement.createdBy !== actorUid) {
      const resultNotifId = `settlement_result_${settlementId}_${newVersion}`;
      transaction.set(db.doc(`users/${settlement.createdBy}/notifications/${resultNotifId}`), {
        id: resultNotifId,
        type: action === "approve" ? "settlement_approved" : "settlement_rejected",
        status: "read",
        groupId,
        groupName: group.name || "",
        settlementId,
        payerName,
        receiverName,
        amountMinor: settlement.amountMinor,
        currency: settlement.currency,
        paymentReference: settlement.paymentReference,
        rejectionReason: action === "reject" ? trimmedReason || "No reason provided" : undefined,
        actedByName: actorDoc.displayName || receiverName,
        createdAt: timestamp,
      });
    }

    await syncLinkedPaymentStatusInTx(
      transaction,
      trackingSnap,
      trackingRef,
      siblingSnaps,
      settlementId,
      targetStatus,
      actorUid,
      timestamp
    );

    transaction.update(groupRef, {
      updatedAt: timestamp,
      updatedBy: actorUid,
      latestActivityAt: timestamp,
      version: FieldValue.increment(1),
    });

    return receipt.result;
  });
}

export const handleApproveSettlement = async (
  data: ResolveSettlementInput,
  context: functions.https.CallableContext
): Promise<any> => resolvePendingSettlement(data, context, "approve");

export const handleRejectSettlement = async (
  data: ResolveSettlementInput,
  context: functions.https.CallableContext
): Promise<any> => resolvePendingSettlement(data, context, "reject");

export const handleCancelSettlement = async (
  data: ResolveSettlementInput,
  context: functions.https.CallableContext
): Promise<any> => resolvePendingSettlement(data, context, "cancel");

export const handleVoidSettlement = async (
  data: VoidSettlementInput,
  context: functions.https.CallableContext
): Promise<any> => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Only authenticated users can void settlements."
    );
  }
  const actorUid = context.auth.uid;

  const { clientOperationId, groupId, settlementId, expectedVersion, voidReason } = data;

  if (!clientOperationId || !groupId || !settlementId || expectedVersion === undefined) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required fields for settlement voiding."
    );
  }

  const db = admin.firestore();
  const groupRef = db.doc(`groups/${groupId}`);
  const operationRef = db.doc(`groups/${groupId}/settlementOperations/${clientOperationId}`);
  const settlementRef = db.doc(`groups/${groupId}/settlements/${settlementId}`);
  const memberActorRef = db.doc(`groups/${groupId}/members/${actorUid}`);

  const payloadHash = computePayloadHash({
    groupId,
    settlementId,
    expectedVersion,
    voidReason: voidReason || "",
  });

  return db.runTransaction(async (transaction) => {
    // 1. Check Idempotency Receipt
    const opSnap = await transaction.get(operationRef);
    if (opSnap.exists) {
      const receipt = opSnap.data() as SettlementOperationReceipt;
      if (receipt.payloadHash !== payloadHash) {
        throw new functions.https.HttpsError(
          "already-exists",
          "An operation with this ID exists with a different payload."
        );
      }
      return receipt.result;
    }

    // 2. Fetch Group
    const groupSnap = await transaction.get(groupRef);
    if (!groupSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Group not found.");
    }
    const group = groupSnap.data()!;

    // Block write on archived or deleted groups
    if (group.status === "archived" || group.status === "deleted") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Cannot void settlements in an archived or deleted group."
      );
    }

    // 3. Fetch Actor & Settlement
    const [actorSnap, setSnap] = await Promise.all([
      transaction.get(memberActorRef),
      transaction.get(settlementRef),
    ]);

    if (!actorSnap.exists || actorSnap.data()!.status !== "active") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Actor is not an active member of the group."
      );
    }
    const actorRole = actorSnap.data()!.role;

    if (!setSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Settlement not found.");
    }
    const settlement = setSnap.data() as SettlementDocument;

    // Check version lock conflict
    if (settlement.version !== expectedVersion) {
      throw new functions.https.HttpsError(
        "aborted",
        "Conflict: The settlement has been modified by another transaction.",
        {
          currentVersion: settlement.version,
          expectedVersion,
        }
      );
    }

    if (settlement.status === "voided") {
      const receipt: SettlementOperationReceipt = {
        clientOperationId,
        groupId,
        type: "void",
        actorUid: actorUid,
        settlementId,
        payloadHash,
        createdAt: Timestamp.now(),
        result: {
          settlementId,
          version: settlement.version,
          status: "voided",
        },
      };
      transaction.set(operationRef, receipt);
      return receipt.result;
    }

    if (settlement.status !== "active") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Cannot void a settlement with status "${settlement.status}". Pending requests must be rejected or cancelled.`
      );
    }

    // 4. Fetch Payer & Receiver to check strict permissions
    const memberPayerRef = db.doc(`groups/${groupId}/members/${settlement.payerId}`);
    const memberReceiverRef = db.doc(`groups/${groupId}/members/${settlement.receiverId}`);
    const [payerSnap, receiverSnap] = await Promise.all([
      transaction.get(memberPayerRef),
      transaction.get(memberReceiverRef),
    ]);

    const payerDoc = payerSnap.exists ? payerSnap.data()! : null;
    const receiverDoc = receiverSnap.exists ? receiverSnap.data()! : null;

    if (actorRole === "viewer") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Viewers are read-only and cannot void settlements."
      );
    }

    assertCanVoidActiveSettlement(actorUid, actorRole, settlement, payerDoc, receiverDoc);

    // Read linked payment tracking if applicable BEFORE writes
    let trackingRef: FirebaseFirestore.DocumentReference | null = null;
    let trackingSnap: FirebaseFirestore.DocumentSnapshot | null = null;
    let siblingSnaps: FirebaseFirestore.DocumentSnapshot[] = [];
    if (settlement.relatedExpenseId && settlement.relatedMemberId) {
      trackingRef = db.doc(
        `groups/${groupId}/expenses/${settlement.relatedExpenseId}/payments/${settlement.relatedMemberId}`
      );
      trackingSnap = await transaction.get(trackingRef);
      if (trackingSnap.exists) {
        const sIds: string[] = trackingSnap.data()!.settlementIds || [];
        siblingSnaps = await Promise.all(
          sIds.map((id) => transaction.get(db.doc(`groups/${groupId}/settlements/${id}`)))
        );
      }
    }

    // 5. Write voiding
    const timestamp = Timestamp.now();
    const newVersion = settlement.version + 1;

    const updatedSettlement: Partial<SettlementDocument> = {
      status: "voided",
      voidReason: voidReason || "No reason provided",
      version: newVersion,
      updatedAt: timestamp,
      updatedBy: actorUid,
      latestOperationId: clientOperationId,
    };

    const revisionDoc: SettlementRevision = {
      id: String(newVersion),
      settlementId,
      groupId,
      payerId: settlement.payerId,
      receiverId: settlement.receiverId,
      amountMinor: settlement.amountMinor,
      currency: settlement.currency,
      baseAmountMinor: settlement.baseAmountMinor,
      fx: settlement.fx,
      status: "voided",
      paymentReference: settlement.paymentReference,
      voidReason: voidReason || "No reason provided",
      version: newVersion,
      schemaVersion: 1,
      operationId: clientOperationId,
      createdAt: timestamp,
      createdBy: actorUid,
      ...(settlement.relatedExpenseId ? { relatedExpenseId: settlement.relatedExpenseId } : {}),
      ...(settlement.relatedMemberId ? { relatedMemberId: settlement.relatedMemberId } : {}),
    };

    const receipt: SettlementOperationReceipt = {
      clientOperationId,
      groupId,
      type: "void",
      actorUid: actorUid,
      settlementId,
      payloadHash,
      createdAt: timestamp,
      result: {
        settlementId,
        version: newVersion,
        status: "voided",
      },
    };

    const activityId = db.collection(`groups/${groupId}/activities`).doc().id;
    const payerName = payerDoc ? payerDoc.displayName : settlement.payerId;
    const receiverName = receiverDoc ? receiverDoc.displayName : settlement.receiverId;
    const formattedAmount = formatSettlementAmount(settlement.amountMinor, settlement.currency);

    const activityDoc = {
      id: activityId,
      groupId,
      type: "settlement_voided",
      summary: `Voided repayment: ${payerName} paid ${receiverName} ${formattedAmount}`,
      actorUserId: actorUid,
      entityId: settlementId,
      createdAt: timestamp,
    };

    transaction.update(settlementRef, updatedSettlement);
    transaction.set(db.doc(`groups/${groupId}/settlements/${settlementId}/revisions/${newVersion}`), revisionDoc);
    transaction.set(operationRef, receipt);
    transaction.set(db.doc(`groups/${groupId}/activities/${activityId}`), activityDoc);

    await syncLinkedPaymentStatusInTx(
      transaction,
      trackingSnap,
      trackingRef,
      siblingSnaps,
      settlementId,
      "voided",
      actorUid,
      timestamp
    );

    // Update group latest metadata
    transaction.update(groupRef, {
      updatedAt: timestamp,
      updatedBy: actorUid,
      latestActivityAt: timestamp,
      version: FieldValue.increment(1),
    });

    return receipt.result;
  });
};

interface SettleExpenseSplitInput {
  clientOperationId: string;
  groupId: string;
  expenseId: string;
  memberId: string;
  paymentReference?: string;
}

export const handleSettleExpenseSplit = async (
  data: SettleExpenseSplitInput,
  context: functions.https.CallableContext
): Promise<any> => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication is required."
    );
  }
  const actorUid = context.auth.uid;

  const { clientOperationId, groupId, expenseId, memberId, paymentReference: rawPaymentReference } = data;
  if (!clientOperationId || !groupId || !expenseId || !memberId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required fields."
    );
  }

  const paymentReference = normalizePaymentReference(rawPaymentReference);

  const db = admin.firestore();
  const groupRef = db.doc(`groups/${groupId}`);
  const expenseRef = db.doc(`groups/${groupId}/expenses/${expenseId}`);
  const memberActorRef = db.doc(`groups/${groupId}/members/${actorUid}`);
  const splitMemberRef = db.doc(`groups/${groupId}/members/${memberId}`);
  const paymentTrackingRef = db.doc(`groups/${groupId}/expenses/${expenseId}/payments/${memberId}`);
  const operationRef = db.doc(`groups/${groupId}/settlementOperations/${clientOperationId}`);

  const payloadHash = computePayloadHash({
    groupId,
    expenseId,
    memberId,
    ...(paymentReference ? { paymentReference } : {}),
  });

  return db.runTransaction(async (transaction) => {
    // 1. Idempotency Check
    const opSnap = await transaction.get(operationRef);
    if (opSnap.exists) {
      const receipt = opSnap.data() as SettlementOperationReceipt;
      if (receipt.payloadHash !== payloadHash) {
        throw new functions.https.HttpsError(
          "already-exists",
          "An operation with this ID exists with a different payload."
        );
      }
      return receipt.result;
    }

    // 2. Fetch Group, Actor, Expense, Split Member & Tracking BEFORE any writes
    const [groupSnap, actorSnap, expenseSnap, splitMemberSnap, trackingSnap] = await Promise.all([
      transaction.get(groupRef),
      transaction.get(memberActorRef),
      transaction.get(expenseRef),
      transaction.get(splitMemberRef),
      transaction.get(paymentTrackingRef),
    ]);

    if (!groupSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Group not found.", {
        reason: "group_not_found",
        path: groupRef.path,
      });
    }
    const group = groupSnap.data()!;
    if (group.status === "archived" || group.status === "deleted") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Group is archived or deleted."
      );
    }

    if (!actorSnap.exists || actorSnap.data()!.status !== "active") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Actor is not an active member."
      );
    }
    const actorDoc = actorSnap.data()!;
    const actorRole = actorDoc.role;
    const isOwnerOrAdmin = actorRole === "owner" || actorRole === "admin";

    if (actorRole === "viewer") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Viewers are read-only and cannot settle splits."
      );
    }

    if (!expenseSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Expense not found.", {
        reason: "expense_not_found",
        path: expenseRef.path,
      });
    }
    const expense = expenseSnap.data()!;
    if (expense.status !== "active") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Cannot settle splits on a voided expense."
      );
    }

    const participantIds = expense.participantMemberIds || [];
    if (!participantIds.includes(memberId)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Member is not a participant in this expense."
      );
    }

    if (!splitMemberSnap.exists || splitMemberSnap.data()!.status !== "active") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Participant is not an active member of this group."
      );
    }
    const splitMemberDoc = splitMemberSnap.data()!;

    // Calculate net credit inside this expense for each payer
    const creditors: { memberId: string; credit: number }[] = [];
    expense.payers.forEach((p: any) => {
      const payerSplit = expense.splits.find((s: any) => s.memberId === p.memberId);
      const payerSplitAmount = payerSplit ? payerSplit.amountMinor : 0;
      const netCredit = p.amountMinor - payerSplitAmount;
      if (netCredit > 0) {
        creditors.push({ memberId: p.memberId, credit: netCredit });
      }
    });

    if (creditors.length === 0) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "No net creditors found inside this expense to settle to."
      );
    }

    // Read creditor members and existing settlement docs before writes
    const creditorSnaps = await Promise.all(
      creditors.map((c) => transaction.get(db.doc(`groups/${groupId}/members/${c.memberId}`)))
    );
    const creditorMap = new Map<string, FirebaseFirestore.DocumentData>();
    creditorSnaps.forEach((snap, idx) => {
      if (snap.exists) {
        creditorMap.set(creditors[idx].memberId, snap.data()!);
      }
    });

    // Authorization check: placeholders as debtor still require Owner/Admin.
    // For real-user debtor, either debtor themselves, an expense creditor, expense creator, or Owner/Admin can initiate;
    // receiver approval is still strictly enforced per creditor below.
    if (splitMemberDoc.kind === "placeholder") {
      if (!isOwnerOrAdmin) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Only Owner/Admin can mark settlements involving placeholder debtors."
        );
      }
    } else {
      const isDebtorSelf = splitMemberDoc.userId === actorUid;
      const isCreditorSelf = Array.from(creditorMap.values()).some((c) => c.userId === actorUid);
      const isCreator = expense.createdBy === actorUid;
      if (!isDebtorSelf && !isCreditorSelf && !isCreator && !isOwnerOrAdmin) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "You are not authorized to mark this participant split as paid."
        );
      }
    }

    // Idempotent shortcut if already paid
    if (trackingSnap.exists && trackingSnap.data()!.status === "paid") {
      const trackingData = trackingSnap.data()!;
      const receipt = {
        clientOperationId,
        groupId,
        type: "create",
        actorUid,
        settlementId: trackingData.settlementIds?.[0] || "",
        payloadHash,
        createdAt: Timestamp.now(),
        result: {
          expenseId,
          memberId,
          status: "paid",
        },
      };
      transaction.set(operationRef, receipt);
      return receipt.result;
    }

    const split = expense.splits.find((s: any) => s.memberId === memberId);
    if (!split || split.amountMinor <= 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Participant owes zero or no split found."
      );
    }

    const splits = splitProportional(split.amountMinor, creditors);
    const baseSplits = splitProportional(split.baseAmountMinor, creditors);

    const activeTargets = splits
      .map((share, idx) => ({
        share,
        baseShare: baseSplits[idx],
        settlementId: `${expenseId}_${memberId}_${share.memberId}`,
      }))
      .filter((item) => item.share.amountMinor > 0);

    const existingSetSnaps = await Promise.all(
      activeTargets.map((t) => transaction.get(db.doc(`groups/${groupId}/settlements/${t.settlementId}`)))
    );

    const needsAdminLookup = activeTargets.some((t) => {
      const cDoc = creditorMap.get(t.share.memberId);
      return cDoc && !shouldAutoApproveForReceiver(actorUid, actorRole, cDoc) && cDoc.kind === "placeholder";
    });
    const adminApproverUids = needsAdminLookup
      ? await resolveApproverTargetUids(transaction, db, groupId, { kind: "placeholder" })
      : [];

    const generatedSettlementIds: string[] = [];
    const generatedStatuses: SettlementStatus[] = [];
    const timestamp = Timestamp.now();

    for (let i = 0; i < activeTargets.length; i++) {
      const { share, baseShare, settlementId } = activeTargets[i];
      const existingSnap = existingSetSnaps[i];
      const settlementRef = db.doc(`groups/${groupId}/settlements/${settlementId}`);
      const creditorDoc = creditorMap.get(share.memberId);

      if (!creditorDoc || creditorDoc.status !== "active") {
        throw new functions.https.HttpsError(
          "failed-precondition",
          `Creditor ${share.memberId} is not an active member.`
        );
      }

      if (existingSnap.exists) {
        const existingSet = existingSnap.data() as SettlementDocument;
        if (existingSet.status === "active" || existingSet.status === "pending_approval") {
          generatedSettlementIds.push(settlementId);
          generatedStatuses.push(existingSet.status);
          continue;
        }
      }

      const nextVersion = existingSnap.exists ? (existingSnap.data()!.version || 1) + 1 : 1;
      const autoApproved = shouldAutoApproveForReceiver(actorUid, actorRole, creditorDoc);
      const initialStatus: SettlementStatus = autoApproved ? "active" : "pending_approval";

      const settlementDoc: SettlementDocument = {
        id: settlementId,
        groupId,
        payerId: memberId,
        receiverId: share.memberId,
        amountMinor: share.amountMinor,
        currency: expense.currency,
        baseAmountMinor: baseShare.amountMinor,
        fx: expense.fx,
        status: initialStatus,
        paymentReference,
        ...(autoApproved ? { approvedAt: timestamp, approvedBy: actorUid } : {}),
        createdAt: existingSnap.exists ? existingSnap.data()!.createdAt : timestamp,
        createdBy: actorUid,
        updatedAt: timestamp,
        updatedBy: actorUid,
        version: nextVersion,
        schemaVersion: 1,
        latestOperationId: clientOperationId,
        relatedExpenseId: expenseId,
        relatedMemberId: memberId,
      };

      const revisionDoc: SettlementRevision = {
        id: String(nextVersion),
        settlementId,
        groupId,
        payerId: memberId,
        receiverId: share.memberId,
        amountMinor: share.amountMinor,
        currency: expense.currency,
        baseAmountMinor: baseShare.amountMinor,
        fx: expense.fx,
        status: initialStatus,
        paymentReference,
        version: nextVersion,
        schemaVersion: 1,
        operationId: clientOperationId,
        createdAt: timestamp,
        createdBy: actorUid,
        relatedExpenseId: expenseId,
        relatedMemberId: memberId,
      };

      const activityId = db.collection(`groups/${groupId}/activities`).doc().id;
      const activityDoc = {
        id: activityId,
        groupId,
        type: autoApproved ? "settlement_created" : "settlement_requested",
        summary: autoApproved
          ? `Repayment marked: Split participant resolved share of "${expense.title}"`
          : `Approval requested: ${splitMemberDoc.displayName} marked split share of "${expense.title}" paid`,
        actorUserId: actorUid,
        entityId: settlementId,
        createdAt: timestamp,
      };

      transaction.set(settlementRef, settlementDoc);
      transaction.set(
        db.doc(`groups/${groupId}/settlements/${settlementId}/revisions/${nextVersion}`),
        revisionDoc
      );
      transaction.set(db.doc(`groups/${groupId}/activities/${activityId}`), activityDoc);

      if (!autoApproved) {
        const approverUids =
          creditorDoc.kind === "placeholder"
            ? adminApproverUids
            : creditorDoc.userId
            ? [creditorDoc.userId]
            : [];
        const notifId = notificationDocIdForSettlement(settlementId);
        for (const targetUid of approverUids) {
          if (targetUid === actorUid) continue;
          transaction.set(db.doc(`users/${targetUid}/notifications/${notifId}`), {
            id: notifId,
            type: "settlement_approval_request",
            status: "pending",
            groupId,
            groupName: group.name || "",
            settlementId,
            payerId: memberId,
            payerName: splitMemberDoc.displayName,
            receiverId: share.memberId,
            receiverName: creditorDoc.displayName,
            amountMinor: share.amountMinor,
            baseAmountMinor: baseShare.amountMinor,
            currency: expense.currency,
            groupBaseCurrency: group.baseCurrency,
            paymentReference,
            requestedByUid: actorUid,
            requestedByName: actorDoc.displayName || splitMemberDoc.displayName,
            isPlaceholderReceiver: creditorDoc.kind === "placeholder",
            createdAt: timestamp,
          });
        }
      }

      generatedSettlementIds.push(settlementId);
      generatedStatuses.push(initialStatus);
    }

    const overallStatus: "paid" | "pending_approval" =
      generatedStatuses.length > 0 && generatedStatuses.every((s) => s === "active")
        ? "paid"
        : "pending_approval";

    // 9. Write tracking document
    const trackingVersion = trackingSnap.exists ? (trackingSnap.data()!.version || 1) + 1 : 1;
    const paymentDoc = {
      memberId,
      status: overallStatus,
      settlementIds: generatedSettlementIds,
      markedBy: actorUid,
      markedAt: timestamp,
      version: trackingVersion,
    };
    transaction.set(paymentTrackingRef, paymentDoc);

    // 10. Write operation receipt
    const receipt = {
      clientOperationId,
      groupId,
      type: "create",
      actorUid,
      settlementId: generatedSettlementIds[0] || "",
      payloadHash,
      createdAt: timestamp,
      result: {
        expenseId,
        memberId,
        status: overallStatus,
      },
    };
    transaction.set(operationRef, receipt);

    // Update group latest metadata
    transaction.update(groupRef, {
      updatedAt: timestamp,
      updatedBy: actorUid,
      latestActivityAt: timestamp,
      version: FieldValue.increment(1),
    });

    return receipt.result;
  });
};

export const handleUnsettleExpenseSplit = async (
  data: SettleExpenseSplitInput,
  context: functions.https.CallableContext
): Promise<any> => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication is required."
    );
  }
  const actorUid = context.auth.uid;

  const { clientOperationId, groupId, expenseId, memberId } = data;
  if (!clientOperationId || !groupId || !expenseId || !memberId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required fields."
    );
  }

  const db = admin.firestore();
  const groupRef = db.doc(`groups/${groupId}`);
  const expenseRef = db.doc(`groups/${groupId}/expenses/${expenseId}`);
  const memberActorRef = db.doc(`groups/${groupId}/members/${actorUid}`);
  const paymentTrackingRef = db.doc(`groups/${groupId}/expenses/${expenseId}/payments/${memberId}`);
  const operationRef = db.doc(`groups/${groupId}/settlementOperations/${clientOperationId}`);

  const payloadHash = computePayloadHash({
    groupId,
    expenseId,
    memberId,
    action: "unsettle",
  });

  return db.runTransaction(async (transaction) => {
    // 1. Idempotency Check
    const opSnap = await transaction.get(operationRef);
    if (opSnap.exists) {
      const receipt = opSnap.data() as SettlementOperationReceipt;
      if (receipt.payloadHash !== payloadHash) {
        throw new functions.https.HttpsError(
          "already-exists",
          "An operation with this ID exists with a different payload."
        );
      }
      return receipt.result;
    }

    // 2. Fetch Group, Actor, Expense, Tracking BEFORE writes
    const [groupSnap, actorSnap, expenseSnap, trackingSnap] = await Promise.all([
      transaction.get(groupRef),
      transaction.get(memberActorRef),
      transaction.get(expenseRef),
      transaction.get(paymentTrackingRef),
    ]);

    if (!groupSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Group not found.");
    }
    const group = groupSnap.data()!;
    if (group.status === "archived" || group.status === "deleted") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Group is archived or deleted."
      );
    }

    if (!actorSnap.exists || actorSnap.data()!.status !== "active") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Actor is not an active member."
      );
    }
    const actorRole = actorSnap.data()!.role;
    if (actorRole === "viewer") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Viewers are read-only and cannot mark splits as unpaid."
      );
    }

    if (!expenseSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Expense not found.");
    }
    const expense = expenseSnap.data()!;

    if (!trackingSnap.exists || trackingSnap.data()!.status === "unpaid") {
      const receipt = {
        clientOperationId,
        groupId,
        type: "void",
        actorUid,
        settlementId: "",
        payloadHash,
        createdAt: Timestamp.now(),
        result: {
          expenseId,
          memberId,
          status: "unpaid",
        },
      };
      transaction.set(operationRef, receipt);
      return receipt.result;
    }

    const trackingData = trackingSnap.data()!;
    const settlementIds: string[] = trackingData.settlementIds || [];

    // Read all referenced settlements and their participants BEFORE writes
    const setSnaps = await Promise.all(
      settlementIds.map((id) => transaction.get(db.doc(`groups/${groupId}/settlements/${id}`)))
    );

    const uniqueMemberIds = new Set<string>();
    setSnaps.forEach((snap) => {
      if (snap.exists) {
        const s = snap.data() as SettlementDocument;
        uniqueMemberIds.add(s.payerId);
        uniqueMemberIds.add(s.receiverId);
      }
    });
    const memberSnaps = await Promise.all(
      Array.from(uniqueMemberIds).map((id) => transaction.get(db.doc(`groups/${groupId}/members/${id}`)))
    );
    const memberMap = new Map<string, FirebaseFirestore.DocumentData>();
    memberSnaps.forEach((snap) => {
      if (snap.exists) memberMap.set(snap.id, snap.data()!);
    });

    // Strictly verify authorization for every active/pending settlement before mutating
    let hasPlaceholderPending = false;
    for (const snap of setSnaps) {
      if (!snap.exists) continue;
      const settlement = snap.data() as SettlementDocument;
      const payerDoc = memberMap.get(settlement.payerId) || null;
      const receiverDoc = memberMap.get(settlement.receiverId) || null;
      if (settlement.status === "active") {
        assertCanVoidActiveSettlement(actorUid, actorRole, settlement, payerDoc, receiverDoc);
      } else if (settlement.status === "pending_approval") {
        assertCanCancelPendingSettlement(actorUid, actorRole, settlement, payerDoc);
        if (receiverDoc?.kind === "placeholder") hasPlaceholderPending = true;
      }
    }

    // Read pending notifications to cancel if needed
    const adminApprovers = hasPlaceholderPending
      ? await resolveApproverTargetUids(transaction, db, groupId, { kind: "placeholder" })
      : [];
    const notifUpdates: { ref: FirebaseFirestore.DocumentReference; snap: FirebaseFirestore.DocumentSnapshot }[] = [];
    const pendingNotifReads: Promise<void>[] = [];
    for (const snap of setSnaps) {
      if (!snap.exists) continue;
      const settlement = snap.data() as SettlementDocument;
      if (settlement.status !== "pending_approval") continue;
      const receiverDoc = memberMap.get(settlement.receiverId);
      const targets =
        receiverDoc?.kind === "placeholder"
          ? adminApprovers
          : receiverDoc?.userId
          ? [receiverDoc.userId]
          : [];
      const notifId = notificationDocIdForSettlement(settlement.id);
      for (const uid of targets) {
        const ref = db.doc(`users/${uid}/notifications/${notifId}`);
        pendingNotifReads.push(
          transaction.get(ref).then((nSnap) => {
            if (nSnap.exists) notifUpdates.push({ ref, snap: nSnap });
          })
        );
      }
    }
    await Promise.all(pendingNotifReads);

    const timestamp = Timestamp.now();

    // 7. Void active / cancel pending settlements created by this split status
    for (const snap of setSnaps) {
      if (!snap.exists) continue;
      const settlement = snap.data() as SettlementDocument;
      if (settlement.status !== "active" && settlement.status !== "pending_approval") continue;

      const settlementId = settlement.id;
      const settlementRef = db.doc(`groups/${groupId}/settlements/${settlementId}`);
      const nextStatus: SettlementStatus =
        settlement.status === "pending_approval" ? "cancelled" : "voided";
      const newVersion = settlement.version + 1;

      const updatedSettlement: Partial<SettlementDocument> = {
        status: nextStatus,
        ...(nextStatus === "voided"
          ? { voidReason: "Participant split unmarked as paid" }
          : { cancelledAt: timestamp, cancelledBy: actorUid }),
        updatedAt: timestamp,
        updatedBy: actorUid,
        version: newVersion,
        latestOperationId: clientOperationId,
      };

      const revisionDoc: SettlementRevision = {
        id: String(newVersion),
        settlementId,
        groupId,
        payerId: settlement.payerId,
        receiverId: settlement.receiverId,
        amountMinor: settlement.amountMinor,
        currency: settlement.currency,
        baseAmountMinor: settlement.baseAmountMinor,
        fx: settlement.fx,
        status: nextStatus,
        paymentReference: settlement.paymentReference,
        ...(nextStatus === "voided" ? { voidReason: "Participant split unmarked as paid" } : {}),
        version: newVersion,
        schemaVersion: 1,
        operationId: clientOperationId,
        createdAt: timestamp,
        createdBy: actorUid,
        relatedExpenseId: expenseId,
        relatedMemberId: memberId,
      };

      const activityId = db.collection(`groups/${groupId}/activities`).doc().id;
      const activityDoc = {
        id: activityId,
        groupId,
        type: nextStatus === "voided" ? "settlement_voided" : "settlement_cancelled",
        summary: `Repayment unmarked: Split participant share of "${expense.title}" reverted to unpaid`,
        actorUserId: actorUid,
        entityId: settlementId,
        createdAt: timestamp,
      };

      transaction.update(settlementRef, updatedSettlement);
      transaction.set(
        db.doc(`groups/${groupId}/settlements/${settlementId}/revisions/${newVersion}`),
        revisionDoc
      );
      transaction.set(db.doc(`groups/${groupId}/activities/${activityId}`), activityDoc);
    }

    notifUpdates.forEach(({ ref }) => {
      transaction.update(ref, {
        status: "cancelled",
        resolvedByUid: actorUid,
        resolvedAt: timestamp,
      });
    });

    // 8. Update tracking document
    const updatedPaymentDoc = {
      ...trackingData,
      status: "unpaid",
      markedBy: actorUid,
      markedAt: timestamp,
      version: trackingData.version + 1,
    };
    transaction.set(paymentTrackingRef, updatedPaymentDoc);

    // 9. Write operation receipt
    const receipt = {
      clientOperationId,
      groupId,
      type: "void",
      actorUid,
      settlementId: settlementIds[0] || "",
      payloadHash,
      createdAt: timestamp,
      result: {
        expenseId,
        memberId,
        status: "unpaid",
      },
    };
    transaction.set(operationRef, receipt);

    // Update group latest metadata
    transaction.update(groupRef, {
      updatedAt: timestamp,
      updatedBy: actorUid,
      latestActivityAt: timestamp,
      version: FieldValue.increment(1),
    });

    return receipt.result;
  });
};

