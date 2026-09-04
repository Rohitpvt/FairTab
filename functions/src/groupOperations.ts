/* eslint-disable @typescript-eslint/no-explicit-any */
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { FieldValue, FieldPath } from "firebase-admin/firestore";

interface DeleteGroupInput {
  groupId: string;
}

export async function handleDeleteGroup(
  data: DeleteGroupInput,
  context: functions.https.CallableContext
): Promise<{ status: "processing" | "completed"; processedCount: number }> {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }

  const uid = context.auth.uid;
  const { groupId } = data;

  if (!groupId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing groupId.");
  }

  const db = admin.firestore();
  const groupRef = db.collection("groups").doc(groupId);

  const groupSnap = await groupRef.get();
  if (!groupSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Group not found.");
  }

  const groupData = groupSnap.data()!;
  if (groupData.ownerUserId !== uid) {
    throw new functions.https.HttpsError("permission-denied", "Only the group owner can delete the group.");
  }

  // 1. If not yet marked as deleted, perform initial soft-delete transaction
  if (groupData.status !== "deleted") {
    const activityRef = db.collection(`groups/${groupId}/activities`).doc();
    const activityPayload = {
      id: activityRef.id,
      groupId,
      type: "group_deleted",
      actorUserId: uid,
      entityType: "group",
      entityId: groupId,
      summary: "Group soft-deleted by owner.",
      createdAt: FieldValue.serverTimestamp(),
    };

    const batch = db.batch();
    batch.update(groupRef, {
      status: "deleted",
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
      version: FieldValue.increment(1),
      deletionCleanupStatus: {
        status: "processing",
        lastProcessedMemberId: "",
        processedCount: 0,
      },
    });
    batch.set(activityRef, activityPayload);
    await batch.commit();

    // Reload groupSnap to get the initialized deletionCleanupStatus
    const reloadedSnap = await groupRef.get();
    return processIndexCleanupChunk(groupId, reloadedSnap.data()!, db);
  }

  // 2. If already marked deleted, check and process next index cleanup page
  const cleanupStatus = groupData.deletionCleanupStatus;
  if (!cleanupStatus || cleanupStatus.status === "completed") {
    return { status: "completed", processedCount: cleanupStatus?.processedCount || 0 };
  }

  return processIndexCleanupChunk(groupId, groupData, db);
}

async function processIndexCleanupChunk(
  groupId: string,
  groupData: any,
  db: admin.firestore.Firestore
): Promise<{ status: "processing" | "completed"; processedCount: number }> {
  const cleanupStatus = groupData.deletionCleanupStatus || {
    status: "processing",
    lastProcessedMemberId: "",
    processedCount: 0,
  };

  const lastProcessed = cleanupStatus.lastProcessedMemberId || "";
  const membersRef = db.collection(`groups/${groupId}/members`);
  
  // Query members in a deterministic ordered way
  let query = membersRef.orderBy(FieldPath.documentId()).limit(100);
  if (lastProcessed) {
    query = query.startAfter(lastProcessed);
  }

  const membersSnap = await query.get();
  if (membersSnap.empty) {
    // No more members left to clean up
    await db.collection("groups").doc(groupId).update({
      "deletionCleanupStatus.status": "completed",
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { status: "completed", processedCount: cleanupStatus.processedCount };
  }

  const batch = db.batch();
  let lastMemberId = "";

  membersSnap.docs.forEach((doc) => {
    lastMemberId = doc.id;
    const memberData = doc.data();
    // Only update index if member is backed by an account user ID
    if (memberData.kind === "account" && memberData.userId) {
      const indexRef = db.doc(`userGroupIndex/${memberData.userId}/groups/${groupId}`);
      batch.update(indexRef, {
        status: "deleted",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });

  const processedChunkCount = membersSnap.size;
  const newProcessedCount = cleanupStatus.processedCount + processedChunkCount;
  const nextStatus = processedChunkCount < 100 ? "completed" : "processing";

  // Update group's deletion cleanup cursor
  batch.update(db.collection("groups").doc(groupId), {
    "deletionCleanupStatus.status": nextStatus,
    "deletionCleanupStatus.lastProcessedMemberId": lastMemberId,
    "deletionCleanupStatus.processedCount": newProcessedCount,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return { status: nextStatus, processedCount: newProcessedCount };
}

export interface TransferOwnershipInput {
  groupId: string;
  newOwnerMemberId: string;
}

export async function handleTransferGroupOwnership(
  data: TransferOwnershipInput,
  context: functions.https.CallableContext
): Promise<{ success: boolean; groupId: string; newOwnerUserId: string }> {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }

  const callerUid = context.auth.uid;
  const { groupId, newOwnerMemberId } = data;

  if (!groupId || typeof groupId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Missing or invalid groupId.");
  }

  if (!newOwnerMemberId || typeof newOwnerMemberId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "Missing or invalid newOwnerMemberId.");
  }

  const db = admin.firestore();
  const groupRef = db.collection("groups").doc(groupId);
  const callerMemberRef = db.collection(`groups/${groupId}/members`).doc(callerUid);
  const targetMemberRef = db.collection(`groups/${groupId}/members`).doc(newOwnerMemberId);

  return db.runTransaction(async (transaction) => {
    const groupSnap = await transaction.get(groupRef);
    if (!groupSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Group not found.");
    }

    const groupData = groupSnap.data()!;

    // Verify group is active or archived
    if (groupData.status === "deleted") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Cannot transfer ownership of a deleted group."
      );
    }

    // Verify caller is the current owner
    if (groupData.ownerUserId !== callerUid) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only the current group owner can transfer ownership."
      );
    }

    // Fetch target member doc
    const targetMemberSnap = await transaction.get(targetMemberRef);
    if (!targetMemberSnap.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Target member not found in this group."
      );
    }

    const targetMemberData = targetMemberSnap.data()!;

    // Check target member properties
    if (targetMemberData.status !== "active") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Target member is not active."
      );
    }

    if (targetMemberData.kind !== "account" || !targetMemberData.userId) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Ownership can only be transferred to an account-backed member with a valid user ID."
      );
    }

    const newOwnerUid = targetMemberData.userId;

    // Idempotency: if caller is trying to transfer to self or target is already recorded as owner
    if (newOwnerUid === callerUid) {
      if (groupData.ownerUserId === callerUid && targetMemberData.role === "owner") {
        return { success: true, groupId, newOwnerUserId: callerUid };
      }
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Target member is already the current owner."
      );
    }

    // Check caller member doc
    const callerMemberSnap = await transaction.get(callerMemberRef);
    const callerMemberData = callerMemberSnap.exists ? callerMemberSnap.data() : null;

    // Deterministic activity ID for idempotency per version/transfer
    const currentVersion = groupData.version || 1;
    const nextVersion = currentVersion + 1;
    const activityRef = db
      .collection(`groups/${groupId}/activities`)
      .doc(`transfer_v${nextVersion}_${callerUid}_to_${newOwnerUid}`);

    // Update group document
    transaction.update(groupRef, {
      ownerUserId: newOwnerUid,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: callerUid,
      version: FieldValue.increment(1),
    });

    // Update caller member role: transition to admin (preserves active membership)
    if (callerMemberData && callerMemberData.status === "active") {
      transaction.update(callerMemberRef, {
        role: "admin",
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: callerUid,
        version: FieldValue.increment(1),
      });
    }

    // Update target member role: transition to owner
    transaction.update(targetMemberRef, {
      role: "owner",
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: callerUid,
      version: FieldValue.increment(1),
    });

    // Update userGroupIndex for caller
    const callerIndexRef = db.doc(`userGroupIndex/${callerUid}/groups/${groupId}`);
    transaction.set(
      callerIndexRef,
      {
        groupId,
        groupName: groupData.name || "Group",
        role: "admin",
        status: groupData.status,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Update userGroupIndex for new owner
    const newOwnerIndexRef = db.doc(`userGroupIndex/${newOwnerUid}/groups/${groupId}`);
    transaction.set(
      newOwnerIndexRef,
      {
        groupId,
        groupName: groupData.name || "Group",
        role: "owner",
        status: groupData.status,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Record single ownership transfer activity
    transaction.set(activityRef, {
      id: activityRef.id,
      groupId,
      type: "role_changed",
      actorUserId: callerUid,
      entityType: "group",
      entityId: groupId,
      summary: `Ownership transferred to ${targetMemberData.displayName || "new owner"}.`,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { success: true, groupId, newOwnerUserId: newOwnerUid };
  });
}

