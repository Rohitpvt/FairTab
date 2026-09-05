/* eslint-disable @typescript-eslint/no-explicit-any */
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { FieldValue } from "firebase-admin/firestore";

export async function handleDeleteAccount(
  data: any,
  context: functions.https.CallableContext
): Promise<{ success: boolean }> {
  void data;
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }

  const uid = context.auth.uid;
  const db = admin.firestore();

  // 1. Verify recent authentication token (within 5 minutes = 300 seconds)
  const authTime = context.auth.token.auth_time;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (nowSeconds - authTime > 300) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Re-authentication required. Please log in again to delete your account."
    );
  }

  // 2. Verify ownership blockers
  // Check if this user is the owner of any active or archived group
  const ownedGroupsSnap = await db
    .collection("groups")
    .where("ownerUserId", "==", uid)
    .where("status", "in", ["active", "archived"])
    .limit(1)
    .get();

  if (!ownedGroupsSnap.empty) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Cannot delete account while owning active or archived groups. Please transfer ownership or delete them first."
    );
  }

  // 3. Find all groups where the user is a member (but not owner) and status is active/archived
  const indexColl = db.collection(`userGroupIndex/${uid}/groups`);
  const indexSnap = await indexColl.where("status", "in", ["active", "archived"]).get();

  // For each group membership, leave the group transactionally to prevent double-decrement and double-activity
  for (const indexDoc of indexSnap.docs) {
    const groupId = indexDoc.id;
    const groupRef = db.collection("groups").doc(groupId);
    const memberRef = db.collection(`groups/${groupId}/members`).doc(uid);
    const userIndexRef = db.doc(`userGroupIndex/${uid}/groups/${groupId}`);
    const activityRef = db.collection(`groups/${groupId}/activities`).doc(`leave_${uid}`);

    await db.runTransaction(async (transaction) => {
      const groupSnap = await transaction.get(groupRef);
      const memberSnap = await transaction.get(memberRef);

      if (!groupSnap.exists || !memberSnap.exists) {
        return; // Group or membership doc doesn't exist, skip
      }

      const groupData = groupSnap.data()!;
      const memberData = memberSnap.data()!;

      // Idempotency: if membership is already left, do not edit again
      if (memberData.status === "left") {
        return;
      }

      // Prepare updated memberUserIds
      const currentMembers: string[] = groupData.memberUserIds || [];
      const updatedMembers = currentMembers.filter((mId) => mId !== uid);

      // Decrement count only if user was actually in the list
      const countDecrement = currentMembers.includes(uid) ? -1 : 0;

      transaction.update(memberRef, {
        status: "left",
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
      });

      transaction.update(userIndexRef, {
        status: "left",
        updatedAt: FieldValue.serverTimestamp(),
      });

      transaction.update(groupRef, {
        memberUserIds: updatedMembers,
        activeMemberCount: FieldValue.increment(countDecrement),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
        version: FieldValue.increment(1),
      });

      // Write deterministic member left activity (idempotent, won't duplicate)
      transaction.set(activityRef, {
        id: activityRef.id,
        groupId,
        type: "member_left",
        actorUserId: uid,
        entityType: "member",
        entityId: uid,
        summary: "A user left the group.",
        createdAt: FieldValue.serverTimestamp(),
      });
    });
  }

  // 4. Update user profile to tombstone state
  const profileRef = db.collection("users").doc(uid);
  const profileSnap = await profileRef.get();
  if (profileSnap.exists) {
    const profileData = profileSnap.data()!;
    if (profileData.accountStatus !== "deleted") {
      await profileRef.update({
        accountStatus: "deleted",
        displayName: "Deleted User",
        displayNameLower: "deleted user",
        email: `deleted_${uid}@fairtab.disabled`,
        photoURL: null,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
        version: FieldValue.increment(1),
      });
    }
  }

  // 5. Delete Firebase Auth User as the absolute final server-side action
  try {
    await admin.auth().deleteUser(uid);
  } catch (error: any) {
    // If user was already deleted, or if the serverless runtime environment lacks OAuth2 auth-management IAM roles,
    // we log the notice and return success so the client-side Auth SDK can perform deleteUser() or sign out.
    if (error.code === "auth/user-not-found") {
      // User is already removed
    } else {
      console.warn(`Server-side auth.deleteUser notice for uid ${uid}: ${error.message}`);
    }
  }

  return { success: true };
}

export async function propagateProfileChange(
  db: admin.firestore.Firestore,
  uid: string,
  displayName: string
): Promise<number> {
  const cleanName = displayName.trim();
  const indexColl = db.collection(`userGroupIndex/${uid}/groups`);
  const indexSnap = await indexColl.get();
  let count = 0;

  if (!indexSnap.empty) {
    const batch = db.batch();
    indexSnap.forEach((doc) => {
      const groupId = doc.id;
      const memberRef = db.doc(`groups/${groupId}/members/${uid}`);
      batch.update(memberRef, {
        displayName: cleanName,
        displayNameLower: cleanName.toLowerCase(),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
        version: FieldValue.increment(1),
      });
      count++;
    });
    await batch.commit();
  }
  return count;
}

export async function handleUpdateProfile(
  data: any,
  context: functions.https.CallableContext
): Promise<{ success: boolean }> {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = context.auth.uid;
  const { displayName, photoURL, defaultCurrency, locale, timeZone, onboardingCompleted } = data;

  const db = admin.firestore();
  const userRef = db.doc(`users/${uid}`);

  let cleanName = "";
  if (displayName !== undefined) {
    if (!displayName || !displayName.trim()) {
      throw new functions.https.HttpsError("invalid-argument", "Display name cannot be empty.");
    }
    cleanName = displayName.trim();
  }

  // 1. Update authoritative profile document users/{uid}
  await db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) {
      throw new functions.https.HttpsError("not-found", "User profile document not found.");
    }
    
    const updatePayload: Record<string, any> = {
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
      version: FieldValue.increment(1),
    };

    if (displayName !== undefined) {
      updatePayload.displayName = cleanName;
      updatePayload.displayNameLower = cleanName.toLowerCase();
    }
    if (photoURL !== undefined) updatePayload.photoURL = photoURL;
    if (defaultCurrency !== undefined) updatePayload.defaultCurrency = defaultCurrency;
    if (locale !== undefined) updatePayload.locale = locale;
    if (timeZone !== undefined) updatePayload.timeZone = timeZone;
    if (onboardingCompleted !== undefined) updatePayload.onboardingCompleted = onboardingCompleted;

    transaction.update(userRef, updatePayload);
  });

  // 2. Synchronize Firebase Auth displayName if changed (outside Firestore transaction)
  if (displayName !== undefined) {
    try {
      await admin.auth().updateUser(uid, {
        displayName: cleanName,
      });
    } catch (err: any) {
      console.error(`Failed to update Firebase Auth displayName for ${uid}:`, err);
    }

    // 3. Update required denormalized membership fields
    try {
      await propagateProfileChange(db, uid, cleanName);
    } catch (err: any) {
      console.error(`Failed to propagate displayName to group memberships for ${uid}:`, err);
    }
  }

  return { success: true };
}

export async function handleRepairProfile(
  data: any,
  context: functions.https.CallableContext
): Promise<{ success: boolean; repairedCount: number }> {
  void data;
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = context.auth.uid;
  const db = admin.firestore();
  
  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new functions.https.HttpsError("not-found", "User profile document not found.");
  }
  
  const userData = userSnap.data();
  const displayName = userData?.displayName;
  if (!displayName) {
    throw new functions.https.HttpsError("failed-precondition", "User profile does not contain a display name.");
  }
  
  const repairedCount = await propagateProfileChange(db, uid, displayName);
  return { success: true, repairedCount };
}


