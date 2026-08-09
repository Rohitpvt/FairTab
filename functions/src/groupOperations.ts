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
