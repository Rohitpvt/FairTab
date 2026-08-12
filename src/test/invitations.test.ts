/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import * as admin from "firebase-admin";
import {
  handleCreateEmailInvitation,
  handleAcceptEmailInvitation,
  handleCreateGlobalInviteLink,
  handleRequestJoinViaGlobalLink,
  handleApproveJoinRequest,
} from "../../functions/src/invitationOperations";

// Check if firebase admin is initialized
if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: "mock-project-id",
  });
}

describe("Group Invitations & Notifications Backend Operations Tests", () => {
  let testEnv: RulesTestEnvironment;
  const db = admin.firestore();

  const aliceUid = "alice-inv-test";
  const bobUid = "bob-inv-test";
  const charlieUid = "charlie-inv-test";
  const groupId = "group-inv-test";

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "mock-project-id",
      firestore: { host: "127.0.0.1", port: 8080 },
    });

    // Mock global fetch to avoid real Resend API calls
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation(async (url, options) => {
      const urlString = typeof url === "string" ? url : (url && "url" in (url as any) ? (url as any).url : String(url));
      if (urlString.includes("api.resend.com")) {
        return {
          ok: true,
          status: 200,
          text: async () => "ok",
          json: async () => ({ id: "mock-email-id" }),
        } as any;
      }
      return originalFetch(url, options);
    });

    // Set up Resend API key mock
    process.env.RESEND_API_KEY = "re_mock_api_key";
    process.env.INVITE_FROM_EMAIL = "onboarding@resend.dev";
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();

    // Setup active group
    await db.doc(`groups/${groupId}`).set({
      id: groupId,
      name: "Trip to Paris",
      status: "active",
      ownerUserId: aliceUid,
      memberUserIds: [aliceUid],
      activeMemberCount: 1,
    });

    // Alice is active Owner
    await db.doc(`groups/${groupId}/members/${aliceUid}`).set({
      id: aliceUid,
      groupId,
      kind: "account",
      userId: aliceUid,
      displayName: "Alice Owner",
      role: "owner",
      status: "active",
    });

    // Setup user profiles
    await db.doc(`users/${aliceUid}`).set({
      uid: aliceUid,
      email: "alice@example.com",
      displayName: "Alice Owner",
    });

    await db.doc(`users/${bobUid}`).set({
      uid: bobUid,
      email: "bob@example.com",
      displayName: "Bob Invitee",
    });

    await db.doc(`users/${charlieUid}`).set({
      uid: charlieUid,
      email: "charlie@example.com",
      displayName: "Charlie User",
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  // 1. Create email invitation
  test("create email invitation generates record and handles permissions", async () => {
    const contextAlice = { auth: { uid: aliceUid } } as any;

    // Admin/Owner can invite
    const res = await handleCreateEmailInvitation({
      groupId,
      email: "bob@example.com",
      role: "member"
    }, contextAlice);

    expect(res.invitationId).toBeDefined();
    expect(res.status).toBe("sent");

    // Invite record exists with hashed token
    const inviteSnap = await db.doc(`invitations/${res.invitationId}`).get();
    expect(inviteSnap.exists).toBe(true);
    expect(inviteSnap.data()!.status).toBe("pending");
    expect(inviteSnap.data()!.proposedRole).toBe("member");
    expect(inviteSnap.data()!.tokenHash).toBeDefined();
    expect(inviteSnap.data()!.deliveryStatus).toBe("sent");

    // Cannot invite as Owner
    await expect(handleCreateEmailInvitation({
      groupId,
      email: "charlie@example.com",
      role: "owner" as any
    }, contextAlice)).rejects.toThrow("Cannot invite as Owner.");

    // Non-member/Unauthorized cannot invite
    const contextBob = { auth: { uid: bobUid } } as any;
    await expect(handleCreateEmailInvitation({
      groupId,
      email: "charlie@example.com",
      role: "member"
    }, contextBob)).rejects.toThrow("Only Owner/Admin can invite users.");
  });

  // 2. Accept email invitation
  test("accept email invitation transaction completes Direct Accept", async () => {
    const contextAlice = { auth: { uid: aliceUid } } as any;
    const { invitationId } = await handleCreateEmailInvitation({
      groupId,
      email: "bob@example.com",
      role: "member"
    }, contextAlice);

    // Retrieve tokenHash & simulate rawToken
    const inviteSnap = await db.doc(`invitations/${invitationId}`).get();
    void inviteSnap;

    // Let's manually find the generated rawToken. Since we mock it, let's create a known hash mapping
    // We can overwrite it in database to match a known token hash
    const rawToken = "my-secret-invitation-token-123456";
    const crypto = await import("crypto");
    const testHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    await db.doc(`invitations/${invitationId}`).update({ tokenHash: testHash });

    // Bob accepts invitation
    const contextBob = { auth: { uid: bobUid } } as any;
    const acceptRes = await handleAcceptEmailInvitation({ token: rawToken }, contextBob);
    expect(acceptRes.groupId).toBe(groupId);

    // Invitation is accepted
    const updatedInvite = await db.doc(`invitations/${invitationId}`).get();
    expect(updatedInvite.data()!.status).toBe("accepted");
    expect(updatedInvite.data()!.acceptedBy).toBe(bobUid);

    // Bob is active group member
    const bobMember = await db.doc(`groups/${groupId}/members/${bobUid}`).get();
    expect(bobMember.exists).toBe(true);
    expect(bobMember.data()!.role).toBe("member");
    expect(bobMember.data()!.status).toBe("active");

    // Re-accepting fails
    await expect(handleAcceptEmailInvitation({ token: rawToken }, contextBob)).rejects.toThrow();
  });

  // 3. Global Invite Link & Revoke & Join Request
  test("global invite link lifecycle and join requests flow", async () => {
    const contextAlice = { auth: { uid: aliceUid } } as any;
    
    // Create global link
    const linkRes = await handleCreateGlobalInviteLink({
      groupId,
      role: "viewer"
    }, contextAlice);

    expect(linkRes.token).toBeDefined();
    expect(linkRes.linkId).toBeDefined();

    const linkDoc = await db.doc(`globalInviteLinks/${linkRes.linkId}`).get();
    expect(linkDoc.exists).toBe(true);
    expect(linkDoc.data()!.proposedRole).toBe("viewer");
    expect(linkDoc.data()!.status).toBe("active");

    // Bob requests to join via global link
    const contextBob = { auth: { uid: bobUid } } as any;
    const reqRes = await handleRequestJoinViaGlobalLink({ token: linkRes.token }, contextBob);
    expect(reqRes.requestId).toBe(bobUid);

    const joinReq = await db.doc(`groups/${groupId}/joinRequests/${bobUid}`).get();
    expect(joinReq.exists).toBe(true);
    expect(joinReq.data()!.status).toBe("pending");
    expect(joinReq.data()!.requestedRole).toBe("viewer");

    // Admins get notifications
    const adminNotification = await db.collection(`users/${aliceUid}/notifications`)
      .where("type", "==", "join_request")
      .where("applicantUid", "==", bobUid)
      .get();
    expect(adminNotification.empty).toBe(false);
    expect(adminNotification.docs[0].data().status).toBe("pending");

    // Alice approves request
    const approveRes = await handleApproveJoinRequest({
      groupId,
      applicantUid: bobUid
    }, contextAlice);
    expect(approveRes.status).toBe("approved");

    // Bob becomes member
    const bobMember = await db.doc(`groups/${groupId}/members/${bobUid}`).get();
    expect(bobMember.exists).toBe(true);
    expect(bobMember.data()!.role).toBe("viewer");
    expect(bobMember.data()!.status).toBe("active");

    // Notification is approved
    const updatedNotification = await db.doc(`users/${aliceUid}/notifications/${adminNotification.docs[0].id}`).get();
    expect(updatedNotification.data()!.status).toBe("approved");

    // Applicant Bob gets notification approved
    const bobNotification = await db.collection(`users/${bobUid}/notifications`)
      .where("type", "==", "join_request_approved")
      .get();
    expect(bobNotification.empty).toBe(false);
  });
});
