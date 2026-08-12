/* eslint-disable @typescript-eslint/no-explicit-any */
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { FieldValue } from "firebase-admin/firestore";
import * as crypto from "crypto";

// Helper to normalize emails case-insensitively
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Helper to hash token using SHA-256
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Helper to send email using Resend via native fetch
async function sendResendEmail(
  to: string,
  subject: string,
  html: string,
  idempotencyKey: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.INVITE_FROM_EMAIL || "onboarding@resend.dev";

  if (!apiKey) {
    console.warn("RESEND_API_KEY environment variable is not set. Email will not be sent.");
    throw new Error("RESEND_API_KEY is not configured on the server.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject: subject,
      html: html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Resend API error:", errorText);
    throw new Error(`Email delivery failed: ${response.statusText} (${errorText})`);
  }
}

// Helper to verify group Owner/Admin role
async function checkIsOwnerOrAdmin(db: admin.firestore.Firestore, groupId: string, userId: string): Promise<boolean> {
  const memberSnap = await db.doc(`groups/${groupId}/members/${userId}`).get();
  if (!memberSnap.exists) return false;
  const data = memberSnap.data()!;
  return data.status === "active" && (data.role === "owner" || data.role === "admin");
}

// ==========================================
// 1. CREATE EMAIL INVITATION
// ==========================================
interface CreateEmailInvitationInput {
  groupId: string;
  email: string;
  role: "admin" | "member" | "viewer";
}
export async function handleCreateEmailInvitation(
  data: CreateEmailInvitationInput,
  context: functions.https.CallableContext
): Promise<{ invitationId: string; status: string; token: string }> {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = context.auth.uid;
  const { groupId, email, role } = data;

  if (!groupId || !email || !role) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields.");
  }

  if (role as string === "owner") {
    throw new functions.https.HttpsError("invalid-argument", "Cannot invite as Owner.");
  }

  const db = admin.firestore();
  const isAuthorized = await checkIsOwnerOrAdmin(db, groupId, uid);
  if (!isAuthorized) {
    throw new functions.https.HttpsError("permission-denied", "Only Owner/Admin can invite users.");
  }

  const groupSnap = await db.doc(`groups/${groupId}`).get();
  if (!groupSnap.exists || groupSnap.data()!.status !== "active") {
    throw new functions.https.HttpsError("failed-precondition", "Group is not active.");
  }
  const groupData = groupSnap.data()!;

  const normalized = normalizeEmail(email);

  // Check if user is already an active member of this group
  const memberQuery = await db.collection(`groups/${groupId}/members`)
    .where("kind", "==", "account")
    .get();
  
  const emailsInGroup: string[] = [];
  for (const doc of memberQuery.docs) {
    const mem = doc.data();
    if (mem.status === "active" && mem.userId) {
      const userDoc = await db.doc(`users/${mem.userId}`).get();
      if (userDoc.exists && userDoc.data()!.email) {
        emailsInGroup.push(normalizeEmail(userDoc.data()!.email));
      }
    }
  }

  if (emailsInGroup.includes(normalized)) {
    throw new functions.https.HttpsError("already-exists", "Target user is already a member of this group.");
  }

  // Look for existing pending invitation for same email/role
  const existingInvites = await db.collection("invitations")
    .where("groupId", "==", groupId)
    .where("invitedEmailLower", "==", normalized)
    .where("status", "==", "pending")
    .get();

  let inviteId: string;

  if (!existingInvites.empty) {
    const doc = existingInvites.docs[0];
    inviteId = doc.id;
  } else {
    const inviteRef = db.collection("invitations").doc();
    inviteId = inviteRef.id;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitationDoc = {
      id: inviteId,
      groupId,
      groupName: groupData.name,
      invitedEmailLower: normalized,
      invitedBy: uid,
      proposedRole: role,
      status: "pending",
      deliveryStatus: "pending",
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
    };

    await inviteRef.set(invitationDoc);
  }

  // Generate cryptographic token
  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashed = hashToken(rawToken);

  // Update invitation record with new hashed token
  await db.doc(`invitations/${inviteId}`).update({
    tokenHash: hashed,
    deliveryStatus: "pending",
  });

  // Fetch inviter's display name
  const inviterSnap = await db.doc(`users/${uid}`).get();
  const inviterName = inviterSnap.exists ? (inviterSnap.data()!.displayName || "Someone") : "Someone";

  const inviteUrl = `https://rohitpvt.github.io/FairTab/#/invite/${rawToken}`;
  const subject = `Invitation to join ${groupData.name} on FairTab`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
      <h2>FairTab Group Invitation</h2>
      <p><strong>${inviterName}</strong> has invited you to join the group <strong>"${groupData.name}"</strong> as a <strong>${role}</strong>.</p>
      <div style="margin: 30px 0; text-align: center;">
        <a href="${inviteUrl}" style="background-color: #06b6d4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Accept Invitation</a>
      </div>
      <p style="color: #666; font-size: 12px;">This invitation will expire in 7 days.</p>
    </div>
  `;

  try {
    await sendResendEmail(normalized, subject, html, `group-invite/${inviteId}`);
    await db.doc(`invitations/${inviteId}`).update({
      deliveryStatus: "sent",
    });
    return { invitationId: inviteId, status: "sent", token: rawToken };
  } catch (error: any) {
    await db.doc(`invitations/${inviteId}`).update({
      deliveryStatus: "failed",
      deliveryError: error.message || String(error),
    });
    throw new functions.https.HttpsError("internal", error.message || "Failed to send invitation email.");
  }
}

// ==========================================
// 2. ACCEPT EMAIL INVITATION
// ==========================================
interface AcceptEmailInvitationInput {
  token: string;
}
export async function handleAcceptEmailInvitation(
  data: AcceptEmailInvitationInput,
  context: functions.https.CallableContext
): Promise<{ groupId: string }> {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = context.auth.uid;
  const { token } = data;

  if (!token) {
    throw new functions.https.HttpsError("invalid-argument", "Missing token.");
  }

  const hashed = hashToken(token);
  const db = admin.firestore();

  const inviteQuery = await db.collection("invitations")
    .where("tokenHash", "==", hashed)
    .limit(1)
    .get();

  if (inviteQuery.empty) {
    throw new functions.https.HttpsError("not-found", "Invalid or expired invitation token.");
  }

  const inviteDoc = inviteQuery.docs[0];
  const inviteId = inviteDoc.id;
  const invite = inviteDoc.data()!;

  if (invite.status !== "pending") {
    throw new functions.https.HttpsError("failed-precondition", `Invitation is no longer pending (currently ${invite.status}).`);
  }

  const expiresAtTime = invite.expiresAt.toDate().getTime();
  if (Date.now() > expiresAtTime) {
    throw new functions.https.HttpsError("failed-precondition", "Invitation has expired.");
  }

  const groupSnap = await db.doc(`groups/${invite.groupId}`).get();
  if (!groupSnap.exists || groupSnap.data()!.status !== "active") {
    throw new functions.https.HttpsError("failed-precondition", "Group is no longer active.");
  }

  // Verify email match case-insensitively
  const userSnap = await db.doc(`users/${uid}`).get();
  if (!userSnap.exists) {
    throw new functions.https.HttpsError("not-found", "User profile not found.");
  }
  const userProfile = userSnap.data()!;
  const authEmail = normalizeEmail(userProfile.email || "");

  if (invite.invitedEmailLower && authEmail !== invite.invitedEmailLower) {
    throw new functions.https.HttpsError("permission-denied", "This invitation was targeted to a different email address.");
  }

  // Check if already a member
  const memberRef = db.doc(`groups/${invite.groupId}/members/${uid}`);
  const memberSnap = await memberRef.get();
  if (memberSnap.exists && memberSnap.data()!.status === "active") {
    throw new functions.https.HttpsError("already-exists", "You are already an active member of this group.");
  }

  const displayName = userProfile.displayName || "New Member";
  const indexRef = db.doc(`userGroupIndex/${uid}/groups/${invite.groupId}`);
  const activityRef = db.collection(`groups/${invite.groupId}/activities`).doc();

  await db.runTransaction(async (tx) => {
    // Re-verify under transaction
    const inviteTx = await tx.get(inviteDoc.ref);
    if (inviteTx.data()!.status !== "pending") {
      throw new functions.https.HttpsError("failed-precondition", "Invitation already accepted.");
    }

    tx.update(inviteDoc.ref, {
      status: "accepted",
      acceptedAt: FieldValue.serverTimestamp(),
      acceptedBy: uid,
      acceptedActivityId: activityRef.id,
    });

    tx.set(memberRef, {
      id: uid,
      groupId: invite.groupId,
      kind: "account",
      userId: uid,
      displayName,
      displayNameLower: displayName.toLowerCase(),
      avatarURL: userProfile.photoURL || "",
      role: invite.proposedRole,
      status: "active",
      joinedViaInvitationId: inviteId,
      joinedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      createdBy: uid,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
      version: 1,
      schemaVersion: 1,
    });

    tx.set(indexRef, {
      groupId: invite.groupId,
      groupName: invite.groupName,
      role: invite.proposedRole,
      status: "active",
      latestActivityAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(activityRef, {
      id: activityRef.id,
      groupId: invite.groupId,
      type: "member_joined",
      actorUserId: uid,
      entityType: "member",
      entityId: uid,
      summary: `${displayName} joined the group via email invitation.`,
      createdAt: FieldValue.serverTimestamp(),
    });

    tx.update(db.doc(`groups/${invite.groupId}`), {
      memberUserIds: FieldValue.arrayUnion(uid),
      activeMemberCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
      version: FieldValue.increment(1),
    });
  });

  return { groupId: invite.groupId };
}

// ==========================================
// 3. CREATE GLOBAL INVITE LINK
// ==========================================
interface CreateGlobalInviteLinkInput {
  groupId: string;
  role: "admin" | "member" | "viewer";
}
export async function handleCreateGlobalInviteLink(
  data: CreateGlobalInviteLinkInput,
  context: functions.https.CallableContext
): Promise<{ token: string; linkId: string }> {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = context.auth.uid;
  const { groupId, role } = data;

  if (!groupId || !role) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields.");
  }

  if (role as string === "owner") {
    throw new functions.https.HttpsError("invalid-argument", "Cannot create link for Owner role.");
  }

  const db = admin.firestore();
  const isAuthorized = await checkIsOwnerOrAdmin(db, groupId, uid);
  if (!isAuthorized) {
    throw new functions.https.HttpsError("permission-denied", "Only Owner/Admin can create invite links.");
  }

  const groupSnap = await db.doc(`groups/${groupId}`).get();
  if (!groupSnap.exists || groupSnap.data()!.status !== "active") {
    throw new functions.https.HttpsError("failed-precondition", "Group is not active.");
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashed = hashToken(rawToken);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // Reusable links valid for 30 days

  const linkId = hashed; // Use tokenHash as doc ID for quick resolution

  await db.doc(`globalInviteLinks/${linkId}`).set({
    id: linkId,
    groupId,
    groupName: groupSnap.data()!.name,
    proposedRole: role,
    creatorUid: uid,
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
  });

  return { token: rawToken, linkId };
}

// ==========================================
// 4. REVOKE GLOBAL INVITE LINK
// ==========================================
interface RevokeGlobalInviteLinkInput {
  linkId: string;
}
export async function handleRevokeGlobalInviteLink(
  data: RevokeGlobalInviteLinkInput,
  context: functions.https.CallableContext
): Promise<{ status: string }> {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = context.auth.uid;
  const { linkId } = data;

  if (!linkId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing linkId.");
  }

  const db = admin.firestore();
  const linkSnap = await db.doc(`globalInviteLinks/${linkId}`).get();
  if (!linkSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Global invite link not found.");
  }
  const linkData = linkSnap.data()!;

  const isAuthorized = await checkIsOwnerOrAdmin(db, linkData.groupId, uid);
  if (!isAuthorized && linkData.creatorUid !== uid) {
    throw new functions.https.HttpsError("permission-denied", "Unauthorized to revoke this link.");
  }

  await db.doc(`globalInviteLinks/${linkId}`).update({
    status: "revoked",
  });

  return { status: "revoked" };
}

// ==========================================
// 5. REQUEST JOIN VIA GLOBAL LINK
// ==========================================
interface RequestJoinViaGlobalLinkInput {
  token: string;
}
export async function handleRequestJoinViaGlobalLink(
  data: RequestJoinViaGlobalLinkInput,
  context: functions.https.CallableContext
): Promise<{ requestId: string }> {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = context.auth.uid;
  const { token } = data;

  if (!token) {
    throw new functions.https.HttpsError("invalid-argument", "Missing token.");
  }

  const hashed = hashToken(token);
  const db = admin.firestore();

  const linkSnap = await db.doc(`globalInviteLinks/${hashed}`).get();
  if (!linkSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Invalid or expired link token.");
  }
  const link = linkSnap.data()!;

  if (link.status !== "active") {
    throw new functions.https.HttpsError("failed-precondition", "This invite link has been revoked.");
  }

  if (Date.now() > link.expiresAt.toDate().getTime()) {
    throw new functions.https.HttpsError("failed-precondition", "This invite link has expired.");
  }

  const groupSnap = await db.doc(`groups/${link.groupId}`).get();
  if (!groupSnap.exists || groupSnap.data()!.status !== "active") {
    throw new functions.https.HttpsError("failed-precondition", "Group is no longer active.");
  }

  // Check membership
  const memberSnap = await db.doc(`groups/${link.groupId}/members/${uid}`).get();
  if (memberSnap.exists && memberSnap.data()!.status === "active") {
    throw new functions.https.HttpsError("already-exists", "You are already a member of this group.");
  }

  // Check if duplicate pending join request exists by query
  const duplicateRequests = await db.collection(`groups/${link.groupId}/joinRequests`)
    .where("userId", "==", uid)
    .where("status", "==", "pending")
    .limit(1)
    .get();

  if (!duplicateRequests.empty) {
    const staleReq = duplicateRequests.docs[0];
    const staleData = staleReq.data();
    const staleApprovers: string[] = staleData.approverUids || [];
    console.log(`[requestJoin] Found existing pending request ${staleReq.id} for user ${uid} in group ${link.groupId}. Deleting it to re-create with fresh notifications.`);

    const deleteBatch = db.batch();
    // Delete deterministic notifications if approvers were stored
    staleApprovers.forEach((approverUid) => {
      const notifId = `${staleReq.id}_${approverUid}`;
      deleteBatch.delete(db.doc(`users/${approverUid}/notifications/${notifId}`));
    });
    // Delete the request itself
    deleteBatch.delete(staleReq.ref);
    await deleteBatch.commit();
    console.log(`[requestJoin] Deleted stale request ${staleReq.id} and its notifications.`);
  }

  const userSnap = await db.doc(`users/${uid}`).get();
  if (!userSnap.exists) {
    throw new functions.https.HttpsError("not-found", "User profile not found.");
  }
  const userProfile = userSnap.data()!;
  const displayName = userProfile.displayName || "Someone";

  const reqRef = db.collection(`groups/${link.groupId}/joinRequests`).doc();
  const requestId = reqRef.id;

  // Notify Owner/Admin users of this group (excluding applicant, inactive members, viewers, regular members, left members, or deleted users)
  const membersSnap = await db.collection(`groups/${link.groupId}/members`).get();
  const admins: string[] = [];
  membersSnap.forEach((mDoc) => {
    const m = mDoc.data();
    console.log(`[requestJoin] Member ${mDoc.id}: role=${m.role}, status=${m.status}, kind=${m.kind}`);
    if (
      m.status === "active" &&
      (m.role === "owner" || m.role === "admin") &&
      mDoc.id !== uid
    ) {
      admins.push(mDoc.id);
    }
  });

  console.log(`[requestJoin] Found ${admins.length} eligible admins to notify: [${admins.join(",")}]`);

  if (admins.length === 0) {
    console.warn(`[requestJoin] WARNING: No eligible owner/admin found for group ${link.groupId}. No notifications will be created.`);
  }

  const requestDoc = {
    id: requestId,
    groupId: link.groupId,
    groupName: link.groupName,
    userId: uid,
    displayName,
    requestedRole: link.proposedRole,
    status: "pending",
    approverUids: admins,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await reqRef.set(requestDoc);
  console.log(`[requestJoin] Created join request ${requestId} for user ${uid} in group ${link.groupId}`);

  const batch = db.batch();
  admins.forEach((adminUid) => {
    const notificationId = `${requestId}_${adminUid}`;
    const notifyRef = db.doc(`users/${adminUid}/notifications/${notificationId}`);
    batch.set(notifyRef, {
      id: notificationId,
      type: "join_request",
      status: "pending",
      groupId: link.groupId,
      groupName: link.groupName,
      applicantUid: uid,
      applicantName: displayName,
      requestedRole: link.proposedRole,
      createdAt: FieldValue.serverTimestamp(),
      joinRequestId: requestId,
    });
    console.log(`[requestJoin] Queued notification ${notificationId} for admin ${adminUid}`);
  });

  await batch.commit();
  console.log(`[requestJoin] Batch committed. ${admins.length} notifications created.`);

  return { requestId };
}

// ==========================================
// 6. APPROVE JOIN REQUEST
// ==========================================
interface ApproveJoinRequestInput {
  groupId: string;
  applicantUid: string;
}
export async function handleApproveJoinRequest(
  data: ApproveJoinRequestInput,
  context: functions.https.CallableContext
): Promise<{ status: string }> {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = context.auth.uid;
  const { groupId, applicantUid } = data;

  if (!groupId || !applicantUid) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields.");
  }

  const db = admin.firestore();
  const isAuthorized = await checkIsOwnerOrAdmin(db, groupId, uid);
  if (!isAuthorized) {
    throw new functions.https.HttpsError("permission-denied", "Only Owner/Admin can approve join requests.");
  }

  const groupSnap = await db.doc(`groups/${groupId}`).get();
  if (!groupSnap.exists || groupSnap.data()!.status !== "active") {
    throw new functions.https.HttpsError("failed-precondition", "Group is not active.");
  }

  const reqQuery = await db.collection(`groups/${groupId}/joinRequests`)
    .where("userId", "==", applicantUid)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  if (reqQuery.empty) {
    throw new functions.https.HttpsError("not-found", "Join request not found or already processed.");
  }
  const reqDoc = reqQuery.docs[0];
  const reqRef = reqDoc.ref;
  const joinRequest = reqDoc.data()!;

  // Check if applicant is already a member
  const memberRef = db.doc(`groups/${groupId}/members/${applicantUid}`);
  const memberSnap = await memberRef.get();
  if (memberSnap.exists && memberSnap.data()!.status === "active") {
    // Just mark request approved and update notifications
    await reqRef.update({ status: "approved", updatedAt: FieldValue.serverTimestamp() });
    return { status: "already_member" };
  }

  const applicantSnap = await db.doc(`users/${applicantUid}`).get();
  if (!applicantSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Applicant user profile not found.");
  }
  const applicantProfile = applicantSnap.data()!;
  const displayName = applicantProfile.displayName || "New Member";

  const indexRef = db.doc(`userGroupIndex/${applicantUid}/groups/${groupId}`);
  const activityRef = db.collection(`groups/${groupId}/activities`).doc();

  await db.runTransaction(async (tx) => {
    // Transactional safety checks
    const reqTx = await tx.get(reqRef);
    if (!reqTx.exists || reqTx.data()!.status !== "pending") {
      throw new functions.https.HttpsError("failed-precondition", "Join request already processed.");
    }

    tx.update(reqRef, {
      status: "approved",
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(memberRef, {
      id: applicantUid,
      groupId,
      kind: "account",
      userId: applicantUid,
      displayName,
      displayNameLower: displayName.toLowerCase(),
      avatarURL: applicantProfile.photoURL || "",
      role: joinRequest.requestedRole,
      status: "active",
      joinedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      createdBy: uid,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
      version: 1,
      schemaVersion: 1,
    });

    tx.set(indexRef, {
      groupId,
      groupName: groupSnap.data()!.name,
      role: joinRequest.requestedRole,
      status: "active",
      latestActivityAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(activityRef, {
      id: activityRef.id,
      groupId,
      type: "member_joined",
      actorUserId: applicantUid,
      entityType: "member",
      entityId: applicantUid,
      summary: `${displayName} joined the group via request approval.`,
      createdAt: FieldValue.serverTimestamp(),
    });

    tx.update(db.doc(`groups/${groupId}`), {
      memberUserIds: FieldValue.arrayUnion(applicantUid),
      activeMemberCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
      version: FieldValue.increment(1),
    });
  });

  const batch = db.batch();

  // Resolve notifications deterministically on all eligible approvers recorded
  const approverUids = joinRequest.approverUids || [];
  approverUids.forEach((adminUid: string) => {
    const notificationId = `${joinRequest.id}_${adminUid}`;
    const notifyRef = db.doc(`users/${adminUid}/notifications/${notificationId}`);
    batch.set(notifyRef, { status: "approved" }, { merge: true });
  });

  // Fallback resolve notifications on all admins
  const notifications = await db.collectionGroup("notifications")
    .where("groupId", "==", groupId)
    .where("applicantUid", "==", applicantUid)
    .where("type", "==", "join_request")
    .get();

  notifications.forEach((nDoc) => {
    batch.update(nDoc.ref, {
      status: "approved",
    });
  });

  // Send notification to applicant that request was accepted
  const applicantNotificationRef = db.collection(`users/${applicantUid}/notifications`).doc();
  batch.set(applicantNotificationRef, {
    id: applicantNotificationRef.id,
    type: "join_request_approved",
    status: "pending",
    groupId,
    groupName: groupSnap.data()!.name,
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return { status: "approved" };
}

// ==========================================
// 7. DECLINE JOIN REQUEST
// ==========================================
interface DeclineJoinRequestInput {
  groupId: string;
  applicantUid: string;
}
export async function handleDeclineJoinRequest(
  data: DeclineJoinRequestInput,
  context: functions.https.CallableContext
): Promise<{ status: string }> {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = context.auth.uid;
  const { groupId, applicantUid } = data;

  if (!groupId || !applicantUid) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields.");
  }

  const db = admin.firestore();
  const isAuthorized = await checkIsOwnerOrAdmin(db, groupId, uid);
  if (!isAuthorized) {
    throw new functions.https.HttpsError("permission-denied", "Only Owner/Admin can decline join requests.");
  }

  const groupSnap = await db.doc(`groups/${groupId}`).get();
  if (!groupSnap.exists || groupSnap.data()!.status !== "active") {
    throw new functions.https.HttpsError("failed-precondition", "Group is not active.");
  }

  const reqQuery = await db.collection(`groups/${groupId}/joinRequests`)
    .where("userId", "==", applicantUid)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  if (reqQuery.empty) {
    throw new functions.https.HttpsError("not-found", "Join request not found or already processed.");
  }
  const reqDoc = reqQuery.docs[0];
  const reqRef = reqDoc.ref;
  const joinRequest = reqDoc.data()!;

  await reqRef.update({
    status: "declined",
    updatedAt: FieldValue.serverTimestamp(),
  });

  const batch = db.batch();

  // Resolve notifications deterministically on all eligible approvers recorded
  const approverUids = joinRequest.approverUids || [];
  approverUids.forEach((adminUid: string) => {
    const notificationId = `${joinRequest.id}_${adminUid}`;
    const notifyRef = db.doc(`users/${adminUid}/notifications/${notificationId}`);
    batch.set(notifyRef, { status: "declined" }, { merge: true });
  });

  // Fallback resolve notifications on all admins
  const notifications = await db.collectionGroup("notifications")
    .where("groupId", "==", groupId)
    .where("applicantUid", "==", applicantUid)
    .where("type", "==", "join_request")
    .get();

  notifications.forEach((nDoc) => {
    batch.update(nDoc.ref, {
      status: "declined",
    });
  });

  // Send notification to applicant that request was declined
  const applicantNotificationRef = db.collection(`users/${applicantUid}/notifications`).doc();
  batch.set(applicantNotificationRef, {
    id: applicantNotificationRef.id,
    type: "join_request_declined",
    status: "pending",
    groupId,
    groupName: groupSnap.data()!.name,
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return { status: "declined" };
}

// ==========================================
// 8. RESOLVE INVITE TOKEN
// ==========================================
interface ResolveInviteTokenInput {
  token: string;
}
export async function handleResolveInviteToken(
  data: ResolveInviteTokenInput,
  context: functions.https.CallableContext
): Promise<{ type: "email" | "global"; groupName: string; inviterName?: string; proposedRole: string }> {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }
  const { token } = data;
  if (!token) {
    throw new functions.https.HttpsError("invalid-argument", "Missing token.");
  }

  const hashed = hashToken(token);
  const db = admin.firestore();

  // Try global link first
  const linkSnap = await db.doc(`globalInviteLinks/${hashed}`).get();
  if (linkSnap.exists) {
    const link = linkSnap.data()!;
    if (link.status !== "active") {
      throw new functions.https.HttpsError("failed-precondition", "This invite link has been revoked.");
    }
    if (Date.now() > link.expiresAt.toDate().getTime()) {
      throw new functions.https.HttpsError("failed-precondition", "This invite link has expired.");
    }
    return {
      type: "global",
      groupName: link.groupName,
      proposedRole: link.proposedRole,
    };
  }

  // Try email invite next
  const inviteQuery = await db.collection("invitations")
    .where("tokenHash", "==", hashed)
    .limit(1)
    .get();

  if (!inviteQuery.empty) {
    const invite = inviteQuery.docs[0].data()!;
    if (invite.status !== "pending") {
      throw new functions.https.HttpsError("failed-precondition", "Invitation is no longer pending.");
    }
    if (Date.now() > invite.expiresAt.toDate().getTime()) {
      throw new functions.https.HttpsError("failed-precondition", "Invitation has expired.");
    }

    const inviterSnap = await db.doc(`users/${invite.invitedBy}`).get();
    const inviterName = inviterSnap.exists ? (inviterSnap.data()!.displayName || "Someone") : "Someone";

    return {
      type: "email",
      groupName: invite.groupName,
      inviterName,
      proposedRole: invite.proposedRole,
    };
  }

  throw new functions.https.HttpsError("not-found", "Invalid or expired invitation token.");
}
