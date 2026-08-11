/* eslint-disable @typescript-eslint/no-explicit-any */
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type {
  SettlementDocument,
  SettlementRevision,
  SettlementOperationReceipt,
} from "@fairtab/domain";
import { computePayloadHash } from "./expenseOperations.js";

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
}

interface VoidSettlementInput {
  clientOperationId: string;
  groupId: string;
  settlementId: string;
  expectedVersion: number;
  voidReason?: string;
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

    // 3. Fetch Actor & Member roles
    const [actorSnap, payerSnap, receiverSnap] = await Promise.all([
      transaction.get(memberActorRef),
      transaction.get(memberPayerRef),
      transaction.get(memberReceiverRef),
    ]);

    if (!actorSnap.exists || actorSnap.data()!.status !== "active") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Actor is not an active member of the group."
      );
    }
    const actorRole = actorSnap.data()!.role;

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

    const payerDoc = payerSnap.data()!;
    const receiverDoc = receiverSnap.data()!;

    // Check placeholder involvement and role constraints
    const isPayerPlaceholder = payerDoc.kind === "placeholder";
    const isReceiverPlaceholder = receiverDoc.kind === "placeholder";

    if (actorRole === "viewer") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Viewers are read-only and cannot record settlements."
      );
    }

    if (isPayerPlaceholder || isReceiverPlaceholder) {
      // Admin/Owner must authorize settlements involving placeholder members
      if (actorRole !== "owner" && actorRole !== "admin") {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Only Owner/Admin can record settlements involving placeholders."
        );
      }
    } else {
      // If normal member, they must be either the payer or receiver themselves
      if (actorRole !== "owner" && actorRole !== "admin") {
        if (payerDoc.userId !== actorUid && receiverDoc.userId !== actorUid) {
          throw new functions.https.HttpsError(
            "permission-denied",
            "A normal member can only record settlements involving themselves."
          );
        }
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

    // 5. Check duplicate settlement ID
    const setSnap = await transaction.get(settlementRef);
    if (setSnap.exists) {
      throw new functions.https.HttpsError("already-exists", "Settlement ID already exists.");
    }

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
      status: "active",
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
      status: "active",
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
      },
    };

    const activityId = db.collection(`groups/${groupId}/activities`).doc().id;
    const payerName = payerDoc.displayName;
    const receiverName = receiverDoc.displayName;
    const formattedAmount = `${(amountMinor / 100).toFixed(2)} ${currency}`;
    const activityDoc = {
      id: activityId,
      groupId,
      type: "settlement_created",
      summary: `${payerName} paid ${receiverName} ${formattedAmount}`,
      actorUserId: actorUid,
      entityId: settlementId,
      createdAt: timestamp,
    };

    transaction.set(settlementRef, settlementDoc);
    transaction.set(db.doc(`groups/${groupId}/settlements/${settlementId}/revisions/1`), revisionDoc);
    transaction.set(operationRef, receipt);
    transaction.set(db.doc(`groups/${groupId}/activities/${activityId}`), activityDoc);

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

    // 3. Fetch Actor
    const actorSnap = await transaction.get(memberActorRef);
    if (!actorSnap.exists || actorSnap.data()!.status !== "active") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Actor is not an active member of the group."
      );
    }
    const actorRole = actorSnap.data()!.role;

    // 4. Fetch Settlement
    const setSnap = await transaction.get(settlementRef);
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
      // Already voided, do nothing but log receipt
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
        },
      };
      transaction.set(operationRef, receipt);
      return receipt.result;
    }

    // 5. Fetch Payer & Receiver to check permissions and placeholder checks
    const memberPayerRef = db.doc(`groups/${groupId}/members/${settlement.payerId}`);
    const memberReceiverRef = db.doc(`groups/${groupId}/members/${settlement.receiverId}`);
    const [payerSnap, receiverSnap] = await Promise.all([
      transaction.get(memberPayerRef),
      transaction.get(memberReceiverRef),
    ]);

    const payerDoc = payerSnap.exists ? payerSnap.data() : null;
    const receiverDoc = receiverSnap.exists ? receiverSnap.data() : null;

    if (actorRole === "viewer") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Viewers are read-only and cannot void settlements."
      );
    }

    const isPayerPlaceholder = payerDoc?.kind === "placeholder";
    const isReceiverPlaceholder = receiverDoc?.kind === "placeholder";

    if (isPayerPlaceholder || isReceiverPlaceholder) {
      // Placeholder: only admin/owner can void
      if (actorRole !== "owner" && actorRole !== "admin") {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Only Owner/Admin can void settlements involving placeholders."
        );
      }
    } else {
      // Non-placeholder: owner/admin can void anything. Normal member can only void if:
      // 1. They originally created the settlement (settlement.createdBy === actorUid)
      // AND
      // 2. They are involved in it (payerId or receiverId matches their memberId)
      if (actorRole !== "owner" && actorRole !== "admin") {
        const isParticipant =
          (payerDoc && payerDoc.userId === actorUid) ||
          (receiverDoc && receiverDoc.userId === actorUid);

        if (settlement.createdBy !== actorUid || !isParticipant) {
          throw new functions.https.HttpsError(
            "permission-denied",
            "A normal member can only void a settlement they created and that involves themselves."
          );
        }
      }
    }

    // 6. Write voiding
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
      voidReason: voidReason || "No reason provided",
      version: newVersion,
      schemaVersion: 1,
      operationId: clientOperationId,
      createdAt: timestamp,
      createdBy: actorUid,
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
      },
    };

    const activityId = db.collection(`groups/${groupId}/activities`).doc().id;
    const payerName = payerDoc ? payerDoc.displayName : settlement.payerId;
    const receiverName = receiverDoc ? receiverDoc.displayName : settlement.receiverId;
    const formattedAmount = `${(settlement.amountMinor / 100).toFixed(2)} ${settlement.currency}`;

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
