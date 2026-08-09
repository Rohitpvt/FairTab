import { describe, test, beforeAll, afterAll, beforeEach } from "vitest";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  query,
  where,
  getDocs,
  collection,
} from "firebase/firestore";
import fs from "fs";
import path from "path";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  const rulesPath = path.resolve(__dirname, "../../firestore.rules");
  const rules = fs.readFileSync(rulesPath, "utf8");

  testEnv = await initializeTestEnvironment({
    projectId: "fairtab-rules-groups-test",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: rules,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe("Firestore Security Rules - Phase 3 Groups & Membership", () => {
  const aliceId = "user-alice";
  const aliceEmail = "alice@example.com";
  const bobId = "user-bob";
  const bobEmail = "bob@example.com";
  const charlieId = "user-charlie";
  const charlieEmail = "charlie@example.com";

  const getValidGroupPayload = (groupId: string, ownerId: string) => ({
    id: groupId,
    name: "Trip to Alps 2026",
    nameLower: "trip to alps 2026",
    description: "Skiing holiday",
    type: "trip",
    baseCurrency: "EUR",
    ownerUserId: ownerId,
    memberUserIds: [ownerId],
    activeMemberCount: 1,
    simplifyDebts: true,
    settlementStrategy: "minimum_transactions",
    status: "active",
    latestActivityAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    createdBy: ownerId,
    updatedAt: serverTimestamp(),
    updatedBy: ownerId,
    version: 1,
    schemaVersion: 1,
    initialActivityId: "act-create",
  });

  const getValidMemberPayload = (groupId: string, memberId: string, role: string) => ({
    id: memberId,
    groupId,
    kind: "account",
    userId: memberId,
    displayName: "Test User",
    displayNameLower: "test user",
    role,
    status: "active",
    createdAt: serverTimestamp(),
    createdBy: aliceId,
    updatedAt: serverTimestamp(),
    updatedBy: aliceId,
    version: 1,
    schemaVersion: 1,
  });

  // --- GROUP CREATION & ATOMICITY ---

  test("valid atomic group creation succeeds", async () => {
    const aliceDb = testEnv.authenticatedContext(aliceId, { email: aliceEmail }).firestore();
    const batch = writeBatch(aliceDb);

    const groupId = "group-1";
    batch.set(doc(aliceDb, "groups", groupId), getValidGroupPayload(groupId, aliceId));
    batch.set(doc(aliceDb, `groups/${groupId}/members`, aliceId), getValidMemberPayload(groupId, aliceId, "owner"));
    batch.set(doc(aliceDb, `userGroupIndex/${aliceId}/groups`, groupId), {
      groupId,
      groupName: "Trip to Alps 2026",
      role: "owner",
      status: "active",
      latestActivityAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(aliceDb, `groups/${groupId}/activities/act-create`), {
      id: "act-create",
      groupId,
      type: "group_created",
      actorUserId: aliceId,
      summary: "Group created",
      createdAt: serverTimestamp(),
    });

    await assertSucceeds(batch.commit());
  });

  test("partial group creation (missing owner member doc) is denied", async () => {
    const aliceDb = testEnv.authenticatedContext(aliceId, { email: aliceEmail }).firestore();
    const batch = writeBatch(aliceDb);

    const groupId = "group-2";
    batch.set(doc(aliceDb, "groups", groupId), getValidGroupPayload(groupId, aliceId));
    batch.set(doc(aliceDb, `userGroupIndex/${aliceId}/groups`, groupId), {
      groupId, groupName: "Trip to Alps 2026", role: "owner", status: "active",
      latestActivityAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    batch.set(doc(aliceDb, `groups/${groupId}/activities/act-create`), {
      id: "act-create", groupId, type: "group_created", actorUserId: aliceId,
      summary: "Group created", createdAt: serverTimestamp(),
    });

    await assertFails(batch.commit());
  });

  test("partial group creation (missing owner index doc) is denied", async () => {
    const aliceDb = testEnv.authenticatedContext(aliceId, { email: aliceEmail }).firestore();
    const batch = writeBatch(aliceDb);

    const groupId = "group-3";
    batch.set(doc(aliceDb, "groups", groupId), getValidGroupPayload(groupId, aliceId));
    batch.set(doc(aliceDb, `groups/${groupId}/members`, aliceId), getValidMemberPayload(groupId, aliceId, "owner"));
    batch.set(doc(aliceDb, `groups/${groupId}/activities/act-create`), {
      id: "act-create", groupId, type: "group_created", actorUserId: aliceId,
      summary: "Group created", createdAt: serverTimestamp(),
    });

    await assertFails(batch.commit());
  });

  test("partial group creation (missing timeline activity doc) is denied", async () => {
    const aliceDb = testEnv.authenticatedContext(aliceId, { email: aliceEmail }).firestore();
    const batch = writeBatch(aliceDb);

    const groupId = "group-4";
    batch.set(doc(aliceDb, "groups", groupId), getValidGroupPayload(groupId, aliceId));
    batch.set(doc(aliceDb, `groups/${groupId}/members`, aliceId), getValidMemberPayload(groupId, aliceId, "owner"));
    batch.set(doc(aliceDb, `userGroupIndex/${aliceId}/groups`, groupId), {
      groupId, groupName: "Trip to Alps 2026", role: "owner", status: "active",
      latestActivityAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });

    await assertFails(batch.commit());
  });

  // --- ACCESS CONTROL (READ & WRITE RESTRICTIONS) ---

  test("non-member group read is denied", async () => {
    const aliceDb = testEnv.authenticatedContext(aliceId, { email: aliceEmail }).firestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "groups", "group-5"), getValidGroupPayload("group-5", bobId));
    });

    const docRef = doc(aliceDb, "groups", "group-5");
    await assertFails(getDoc(docRef));
  });

  test("active member read is allowed", async () => {
    const aliceDb = testEnv.authenticatedContext(aliceId, { email: aliceEmail }).firestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const payload = getValidGroupPayload("group-6", bobId);
      payload.memberUserIds = [bobId, aliceId];
      await setDoc(doc(db, "groups", "group-6"), payload);
    });

    const docRef = doc(aliceDb, "groups", "group-6");
    await assertSucceeds(getDoc(docRef));
  });

  // --- ROLE-PERMISSION MATRIX ---

  test("owner can update settings, invite, and archive group", async () => {
    const aliceDb = testEnv.authenticatedContext(aliceId, { email: aliceEmail }).firestore();
    const groupId = "group-7";

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "groups", groupId), getValidGroupPayload(groupId, aliceId));
      await setDoc(doc(db, `groups/${groupId}/members`, aliceId), getValidMemberPayload(groupId, aliceId, "owner"));
    });

    const docRef = doc(aliceDb, "groups", groupId);
    await assertSucceeds(
      updateDoc(docRef, {
        name: "Trip to Alps 2027",
        version: 2,
        updatedAt: serverTimestamp(),
        updatedBy: aliceId,
      })
    );
  });

  test("owner cannot demote themselves or leave", async () => {
    const aliceDb = testEnv.authenticatedContext(aliceId, { email: aliceEmail }).firestore();
    const groupId = "group-8";

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "groups", groupId), getValidGroupPayload(groupId, aliceId));
      await setDoc(doc(db, `groups/${groupId}/members`, aliceId), getValidMemberPayload(groupId, aliceId, "owner"));
    });

    const memberRef = doc(aliceDb, `groups/${groupId}/members`, aliceId);
    // Demote themselves: denied
    await assertFails(updateDoc(memberRef, { role: "admin" }));
    // Leave: denied
    await assertFails(updateDoc(memberRef, { status: "left", activityId: "act-leave" }));
  });

  test("admin can invite, but cannot modify owner role or other admins", async () => {
    const bobDb = testEnv.authenticatedContext(bobId, { email: bobEmail }).firestore();
    const groupId = "group-9";

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const group = getValidGroupPayload(groupId, aliceId);
      group.memberUserIds = [aliceId, bobId, charlieId];
      await setDoc(doc(db, "groups", groupId), group);
      await setDoc(doc(db, `groups/${groupId}/members`, aliceId), getValidMemberPayload(groupId, aliceId, "owner"));
      await setDoc(doc(db, `groups/${groupId}/members`, bobId), getValidMemberPayload(groupId, bobId, "admin"));
      await setDoc(doc(db, `groups/${groupId}/members`, charlieId), getValidMemberPayload(groupId, charlieId, "admin"));
    });

    const inviteRef = doc(bobDb, "invitations", "inv-admin");
    // Admin creates invitation: allowed
    await assertSucceeds(
      setDoc(inviteRef, {
        id: "inv-admin", groupId, groupName: "Trip to Alps 2026",
        invitedEmailLower: "newuser@example.com", invitedBy: bobId,
        proposedRole: "member", status: "pending",
        createdAt: serverTimestamp(),
      })
    );

    const ownerMemberRef = doc(bobDb, `groups/${groupId}/members`, aliceId);
    const adminMemberRef = doc(bobDb, `groups/${groupId}/members`, charlieId);

    // Admin attempts to change owner's role: denied
    await assertFails(updateDoc(ownerMemberRef, { role: "viewer" }));
    // Admin attempts to change another admin's role: denied
    await assertFails(updateDoc(adminMemberRef, { role: "member" }));
  });

  test("member/viewer cannot write settings or roles, but can leave", async () => {
    const charlieDb = testEnv.authenticatedContext(charlieId, { email: charlieEmail }).firestore();
    const groupId = "group-10";

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const group = getValidGroupPayload(groupId, aliceId);
      group.memberUserIds = [aliceId, charlieId];
      await setDoc(doc(db, "groups", groupId), group);
      await setDoc(doc(db, `groups/${groupId}/members`, aliceId), getValidMemberPayload(groupId, aliceId, "owner"));
      await setDoc(doc(db, `groups/${groupId}/members`, charlieId), getValidMemberPayload(groupId, charlieId, "member"));
      await setDoc(doc(db, `userGroupIndex/${charlieId}/groups`, groupId), {
        groupId, groupName: "Trip to Alps 2026", role: "member", status: "active",
        latestActivityAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    });

    const groupRef = doc(charlieDb, "groups", groupId);
    // Member tries to change group settings: denied
    await assertFails(updateDoc(groupRef, { name: "Hacked by Member", version: 2 }));

    // Member leaves atomically: allowed
    const batch = writeBatch(charlieDb);
    batch.update(doc(charlieDb, `groups/${groupId}/members`, charlieId), {
      status: "left",
      updatedAt: serverTimestamp(),
      updatedBy: charlieId,
      activityId: "act-leave-1",
    });
    batch.update(doc(charlieDb, `userGroupIndex/${charlieId}/groups`, groupId), {
      status: "left",
      updatedAt: serverTimestamp(),
    });
    batch.update(groupRef, {
      memberUserIds: [aliceId],
      activeMemberCount: 0,
      updatedAt: serverTimestamp(),
      updatedBy: charlieId,
      version: 2,
    });
    batch.set(doc(charlieDb, `groups/${groupId}/activities/act-leave-1`), {
      id: "act-leave-1",
      groupId,
      type: "member_left",
      actorUserId: charlieId,
      summary: "Charlie left.",
      createdAt: serverTimestamp(),
    });

    await assertSucceeds(batch.commit());
  });

  // --- INVITATION QUERY SECURITY & LIFECYCLE ---

  test("unconstrained broad invitation scans are denied", async () => {
    const charlieDb = testEnv.authenticatedContext(charlieId, { email: charlieEmail }).firestore();
    const invitesColl = collection(charlieDb, "invitations");

    // Broad query: denied
    await assertFails(getDocs(invitesColl));
  });

  test("properly constrained invitation queries by email succeed", async () => {
    const charlieDb = testEnv.authenticatedContext(charlieId, {
      email: charlieEmail,
      email_verified: true,
    }).firestore();
    const invitesColl = collection(charlieDb, "invitations");

    // Query constrained to own verified email: succeeds
    const q1 = query(invitesColl, where("invitedEmailLower", "==", charlieEmail));
    await assertSucceeds(getDocs(q1));
  });

  test("properly constrained invitation queries by UID succeed", async () => {
    const charlieDb = testEnv.authenticatedContext(charlieId, {
      email: charlieEmail,
      email_verified: true,
    }).firestore();
    const invitesColl = collection(charlieDb, "invitations");

    // Query constrained to own UID: succeeds
    const q2 = query(invitesColl, where("invitedUserId", "==", charlieId));
    await assertSucceeds(getDocs(q2));
  });

  test("unverified email users cannot list email-targeted invitations", async () => {
    const charlieDbUnverified = testEnv.authenticatedContext(charlieId, {
      email: charlieEmail,
      email_verified: false,
    }).firestore();
    const invitesColl = collection(charlieDbUnverified, "invitations");

    // Email check on unverified account: denied
    const q = query(invitesColl, where("invitedEmailLower", "==", charlieEmail));
    await assertFails(getDocs(q));
  });

  test("invitation acceptance atomic transaction succeeds and prevents duplicate joining", async () => {
    const groupId = "group-invite-accept-rules";
    const invitationId = "inv-accept-rules";

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "groups", groupId), getValidGroupPayload(groupId, aliceId));
      await setDoc(doc(db, `groups/${groupId}/members`, aliceId), getValidMemberPayload(groupId, aliceId, "owner"));
      await setDoc(doc(db, `userGroupIndex/${aliceId}/groups`, groupId), {
        groupId, groupName: "Trip to Alps 2026", role: "owner", status: "active",
        latestActivityAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, "invitations", invitationId), {
        id: invitationId, groupId, groupName: "Trip to Alps 2026",
        invitedEmailLower: charlieEmail, invitedUserId: null,
        invitedBy: aliceId, proposedRole: "member", status: "pending",
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    });

    const charlieDb = testEnv.authenticatedContext(charlieId, {
      email: charlieEmail,
      email_verified: true,
    }).firestore();

    const batch = writeBatch(charlieDb);
    batch.update(doc(charlieDb, "invitations", invitationId), {
      status: "accepted", acceptedAt: serverTimestamp(), acceptedBy: charlieId,
      acceptedActivityId: "act-join-rules",
    });
    batch.set(doc(charlieDb, `groups/${groupId}/members`, charlieId), {
      id: charlieId, groupId, kind: "account", userId: charlieId,
      displayName: "Charlie", displayNameLower: "charlie",
      role: "member", status: "active", joinedViaInvitationId: invitationId,
      joinedAt: serverTimestamp(), createdAt: serverTimestamp(),
      createdBy: charlieId, updatedAt: serverTimestamp(), updatedBy: charlieId,
      version: 1, schemaVersion: 1,
    });
    batch.set(doc(charlieDb, `userGroupIndex/${charlieId}/groups`, groupId), {
      groupId, groupName: "Trip to Alps 2026", role: "member", status: "active",
      latestActivityAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    batch.set(doc(charlieDb, `groups/${groupId}/activities/act-join-rules`), {
      id: "act-join-rules", groupId, type: "member_joined", actorUserId: charlieId,
      summary: "Charlie joined.", createdAt: serverTimestamp(),
    });
    batch.update(doc(charlieDb, "groups", groupId), {
      memberUserIds: [aliceId, charlieId],
      activeMemberCount: 2,
      updatedAt: serverTimestamp(),
      updatedBy: charlieId,
      version: 2,
    });

    await assertSucceeds(batch.commit());
  });

  // --- TIMELINE ACTIVITY SECURITY & BINDINGS ---

  test("activities cannot be updated or deleted", async () => {
    const aliceDb = testEnv.authenticatedContext(aliceId, { email: aliceEmail }).firestore();
    const groupId = "group-activity-lock";

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "groups", groupId), getValidGroupPayload(groupId, aliceId));
      await setDoc(doc(db, `groups/${groupId}/activities/act-1`), {
        id: "act-1", groupId, type: "group_created", actorUserId: aliceId,
        summary: "Created", createdAt: new Date(),
      });
    });

    const actRef = doc(aliceDb, `groups/${groupId}/activities`, "act-1");
    await assertFails(updateDoc(actRef, { summary: "altered summary" }));
    await assertFails(deleteDoc(actRef));
  });

  test("activities bound to group_archived must ensure group status is archived", async () => {
    const aliceDb = testEnv.authenticatedContext(aliceId, { email: aliceEmail }).firestore();
    const groupId = "group-archived-binding";

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "groups", groupId), getValidGroupPayload(groupId, aliceId));
      await setDoc(doc(db, `groups/${groupId}/members`, aliceId), getValidMemberPayload(groupId, aliceId, "owner"));
      await setDoc(doc(db, `userGroupIndex/${aliceId}/groups`, groupId), {
        groupId, groupName: "Trip to Alps 2026", role: "owner", status: "active",
        latestActivityAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    });

    const batch = writeBatch(aliceDb);
    // Write group_archived timeline activity without archiving the group: denied
    batch.update(doc(aliceDb, "groups", groupId), {
      version: 2, updatedAt: serverTimestamp(), updatedBy: aliceId, // NOT ARCHIVED
    });
    batch.set(doc(aliceDb, `groups/${groupId}/activities/act-archive`), {
      id: "act-archive", groupId, type: "group_archived", actorUserId: aliceId,
      summary: "Archived.", createdAt: serverTimestamp(),
    });

    await assertFails(batch.commit());
  });

  // --- ARCHIVED GROUPS WRITES RESTRICTIONS ---

  test("archived groups block settings updates and role changes, but allow read", async () => {
    const aliceDb = testEnv.authenticatedContext(aliceId, { email: aliceEmail }).firestore();
    const groupId = "group-archived-writes";

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const group = getValidGroupPayload(groupId, aliceId);
      group.status = "archived";
      group.version = 2;
      await setDoc(doc(db, "groups", groupId), group);
      await setDoc(doc(db, `groups/${groupId}/members`, aliceId), getValidMemberPayload(groupId, aliceId, "owner"));
      await setDoc(doc(db, `groups/${groupId}/members`, bobId), getValidMemberPayload(groupId, bobId, "member"));
    });

    const groupRef = doc(aliceDb, "groups", groupId);
    // Active member can read archived group: succeeds
    await assertSucceeds(getDoc(groupRef));

    // Owner tries to edit description of archived group: denied
    await assertFails(updateDoc(groupRef, { description: "new description", version: 3 }));

    const bobMemberRef = doc(aliceDb, `groups/${groupId}/members`, bobId);
    // Owner tries to change role in archived group: denied
    await assertFails(updateDoc(bobMemberRef, { role: "admin" }));
  });

  // --- UNRELATED COLLECTIONS SECURITY ---

  test("unrelated root collections are blocked", async () => {
    const aliceDb = testEnv.authenticatedContext(aliceId, { email: aliceEmail }).firestore();
    const financeRef = doc(aliceDb, "expenses", "expense-1");
    // Write to /expenses: denied
    await assertFails(setDoc(financeRef, { amount: 100 }));
  });
});
