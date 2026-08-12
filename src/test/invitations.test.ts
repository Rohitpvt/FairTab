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

    // Setup active Admin (Charlie) and active Member (David) and active Viewer (Eve) to verify notification recipients
    const davidUid = "david-inv-test";
    const eveUid = "eve-inv-test";

    await db.doc(`groups/${groupId}/members/${charlieUid}`).set({
      id: charlieUid,
      groupId,
      kind: "account",
      userId: charlieUid,
      displayName: "Charlie Admin",
      role: "admin",
      status: "active",
    });

    await db.doc(`groups/${groupId}/members/${davidUid}`).set({
      id: davidUid,
      groupId,
      kind: "account",
      userId: davidUid,
      displayName: "David Member",
      role: "member",
      status: "active",
    });

    await db.doc(`groups/${groupId}/members/${eveUid}`).set({
      id: eveUid,
      groupId,
      kind: "account",
      userId: eveUid,
      displayName: "Eve Viewer",
      role: "viewer",
      status: "active",
    });

    // Bob requests to join via global link
    const contextBob = { auth: { uid: bobUid } } as any;
    const reqRes = await handleRequestJoinViaGlobalLink({ token: linkRes.token }, contextBob);
    expect(reqRes.requestId).toBeDefined();

    // Verify join request was created with random ID and pending status
    const joinReqSnap = await db.doc(`groups/${groupId}/joinRequests/${reqRes.requestId}`).get();
    expect(joinReqSnap.exists).toBe(true);
    expect(joinReqSnap.data()!.status).toBe("pending");
    expect(joinReqSnap.data()!.requestedRole).toBe("viewer");
    expect(joinReqSnap.data()!.approverUids).toContain(aliceUid);
    expect(joinReqSnap.data()!.approverUids).toContain(charlieUid);
    expect(joinReqSnap.data()!.approverUids).not.toContain(davidUid);
    expect(joinReqSnap.data()!.approverUids).not.toContain(eveUid);

    // Verify notifications were created for Owner (Alice) and Admin (Charlie)
    const aliceNotif = await db.doc(`users/${aliceUid}/notifications/${reqRes.requestId}_${aliceUid}`).get();
    expect(aliceNotif.exists).toBe(true);
    expect(aliceNotif.data()!.status).toBe("pending");

    const charlieNotif = await db.doc(`users/${charlieUid}/notifications/${reqRes.requestId}_${charlieUid}`).get();
    expect(charlieNotif.exists).toBe(true);
    expect(charlieNotif.data()!.status).toBe("pending");

    // Verify regular members, viewers, and applicant did not receive approval notifications
    const davidNotif = await db.doc(`users/${davidUid}/notifications/${reqRes.requestId}_${davidUid}`).get();
    expect(davidNotif.exists).toBe(false);

    const eveNotif = await db.doc(`users/${eveUid}/notifications/${reqRes.requestId}_${eveUid}`).get();
    expect(eveNotif.exists).toBe(false);

    const bobNotif = await db.doc(`users/${bobUid}/notifications/${reqRes.requestId}_${bobUid}`).get();
    expect(bobNotif.exists).toBe(false);

    // Verify duplicate requests are rejected
    await expect(handleRequestJoinViaGlobalLink({ token: linkRes.token }, contextBob)).rejects.toThrow();

    // Alice approves request
    const approveRes = await handleApproveJoinRequest({
      groupId,
      applicantUid: bobUid
    }, contextAlice);
    expect(approveRes.status).toBe("approved");

    // Verify Bob becomes member
    const bobMember = await db.doc(`groups/${groupId}/members/${bobUid}`).get();
    expect(bobMember.exists).toBe(true);
    expect(bobMember.data()!.role).toBe("viewer");
    expect(bobMember.data()!.status).toBe("active");

    // Verify all admin/owner notifications are resolved to approved
    const updatedAliceNotif = await db.doc(`users/${aliceUid}/notifications/${reqRes.requestId}_${aliceUid}`).get();
    expect(updatedAliceNotif.data()!.status).toBe("approved");

    const updatedCharlieNotif = await db.doc(`users/${charlieUid}/notifications/${reqRes.requestId}_${charlieUid}`).get();
    expect(updatedCharlieNotif.data()!.status).toBe("approved");

    // Verify applicant Bob received join_request_approved notification
    const bobApprovedNotif = await db.collection(`users/${bobUid}/notifications`)
      .where("type", "==", "join_request_approved")
      .get();
    expect(bobApprovedNotif.empty).toBe(false);

    // Verify concurrent approves remain safe/idempotent
    await expect(handleApproveJoinRequest({
      groupId,
      applicantUid: bobUid
    }, contextAlice)).rejects.toThrow();
  });
});
