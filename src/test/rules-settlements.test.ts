import { describe, test, beforeAll, afterAll, beforeEach } from "vitest";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import fs from "fs";
import path from "path";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  const rulesPath = path.resolve(__dirname, "../../firestore.rules");
  const rules = fs.readFileSync(rulesPath, "utf8");

  testEnv = await initializeTestEnvironment({
    projectId: "fairtab-rules-settlements-test",
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

describe("Firestore Security Rules - Settlements & Revisions", () => {
  const aliceId = "user-alice";
  const aliceEmail = "alice@example.com";
  const bobId = "user-bob";
  const bobEmail = "bob@example.com";
  const charlieId = "user-charlie";
  const charlieEmail = "charlie@example.com";
  const groupId = "group-123";

  // Bootstrap helper to setup group and members
  const bootstrapGroupAndMembers = async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      
      // Setup group
      await setDoc(doc(db, `groups/${groupId}`), {
        id: groupId,
        name: "Test Group",
        nameLower: "test group",
        baseCurrency: "USD",
        ownerUserId: aliceId,
        memberUserIds: [aliceId, bobId], // Charlie is NOT a member
        activeMemberCount: 2,
        simplifyDebts: true,
        settlementStrategy: "minimum_transactions",
        status: "active",
        createdAt: new Date(),
        createdBy: aliceId,
        updatedAt: new Date(),
        updatedBy: aliceId,
        version: 1,
        schemaVersion: 1,
      });

      // Setup member Alice (owner)
      await setDoc(doc(db, `groups/${groupId}/members/${aliceId}`), {
        id: aliceId,
        groupId,
        kind: "account",
        userId: aliceId,
        displayName: "Alice",
        displayNameLower: "alice",
        role: "owner",
        status: "active",
        createdAt: new Date(),
        createdBy: aliceId,
        updatedAt: new Date(),
        updatedBy: aliceId,
        version: 1,
        schemaVersion: 1,
      });

      // Setup member Bob (member)
      await setDoc(doc(db, `groups/${groupId}/members/${bobId}`), {
        id: bobId,
        groupId,
        kind: "account",
        userId: bobId,
        displayName: "Bob",
        displayNameLower: "bob",
        role: "member",
        status: "active",
        createdAt: new Date(),
        createdBy: aliceId,
        updatedAt: new Date(),
        updatedBy: aliceId,
        version: 1,
        schemaVersion: 1,
      });

      // Setup a mock settlement
      await setDoc(doc(db, `groups/${groupId}/settlements/set-1`), {
        id: "set-1",
        groupId,
        payerId: aliceId,
        receiverId: bobId,
        amountMinor: 2000,
        currency: "USD",
        status: "active",
        version: 1,
      });

      // Setup a mock revision
      await setDoc(doc(db, `groups/${groupId}/settlements/set-1/revisions/1`), {
        id: "1",
        settlementId: "set-1",
        groupId,
        payerId: aliceId,
        receiverId: bobId,
        amountMinor: 2000,
        currency: "USD",
        status: "active",
        version: 1,
      });

      // Setup a mock settlement operation
      await setDoc(doc(db, `groups/${groupId}/settlementOperations/op-1`), {
        clientOperationId: "op-1",
        groupId,
        type: "create",
        actorUid: aliceId,
        settlementId: "set-1",
      });
    });
  };

  test("direct client writes on settlements are strictly denied", async () => {
    await bootstrapGroupAndMembers();

    // Alice is Owner, but direct client write is denied
    const aliceDb = testEnv.authenticatedContext(aliceId, { email: aliceEmail }).firestore();
    const settlementRef = doc(aliceDb, `groups/${groupId}/settlements/set-new`);

    await assertFails(
      setDoc(settlementRef, {
        id: "set-new",
        groupId,
        payerId: aliceId,
        receiverId: bobId,
        amountMinor: 5000,
        currency: "USD",
        status: "active",
        version: 1,
      })
    );

    const existingRef = doc(aliceDb, `groups/${groupId}/settlements/set-1`);
    await assertFails(updateDoc(existingRef, { amountMinor: 9999 }));
    await assertFails(deleteDoc(existingRef));
  });

  test("direct client writes on revisions are strictly denied", async () => {
    await bootstrapGroupAndMembers();

    const aliceDb = testEnv.authenticatedContext(aliceId, { email: aliceEmail }).firestore();
    const revRef = doc(aliceDb, `groups/${groupId}/settlements/set-1/revisions/2`);

    await assertFails(
      setDoc(revRef, {
        id: "2",
        settlementId: "set-1",
        groupId,
        version: 2,
      })
    );

    const existingRevRef = doc(aliceDb, `groups/${groupId}/settlements/set-1/revisions/1`);
    await assertFails(updateDoc(existingRevRef, { amountMinor: 9999 }));
    await assertFails(deleteDoc(existingRevRef));
  });

  test("direct client writes on settlementOperations are strictly denied", async () => {
    await bootstrapGroupAndMembers();

    const aliceDb = testEnv.authenticatedContext(aliceId, { email: aliceEmail }).firestore();
    const opRef = doc(aliceDb, `groups/${groupId}/settlementOperations/op-new`);

    await assertFails(
      setDoc(opRef, {
        clientOperationId: "op-new",
        groupId,
        type: "create",
      })
    );

    const existingOpRef = doc(aliceDb, `groups/${groupId}/settlementOperations/op-1`);
    await assertFails(updateDoc(existingOpRef, { type: "void" }));
    await assertFails(deleteDoc(existingOpRef));
  });

  test("active group members can read settlements and revisions", async () => {
    await bootstrapGroupAndMembers();

    // Alice is active member
    const aliceDb = testEnv.authenticatedContext(aliceId, { email: aliceEmail }).firestore();
    await assertSucceeds(getDoc(doc(aliceDb, `groups/${groupId}/settlements/set-1`)));
    await assertSucceeds(getDoc(doc(aliceDb, `groups/${groupId}/settlements/set-1/revisions/1`)));

    // Bob is active member
    const bobDb = testEnv.authenticatedContext(bobId, { email: bobEmail }).firestore();
    await assertSucceeds(getDoc(doc(bobDb, `groups/${groupId}/settlements/set-1`)));
    await assertSucceeds(getDoc(doc(bobDb, `groups/${groupId}/settlements/set-1/revisions/1`)));
  });

  test("non-members and unauthenticated users cannot read settlements or revisions", async () => {
    await bootstrapGroupAndMembers();

    // Charlie is authenticated but NOT a member of group-123
    const charlieDb = testEnv.authenticatedContext(charlieId, { email: charlieEmail }).firestore();
    await assertFails(getDoc(doc(charlieDb, `groups/${groupId}/settlements/set-1`)));
    await assertFails(getDoc(doc(charlieDb, `groups/${groupId}/settlements/set-1/revisions/1`)));

    // Unauthenticated
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(unauthDb, `groups/${groupId}/settlements/set-1`)));
    await assertFails(getDoc(doc(unauthDb, `groups/${groupId}/settlements/set-1/revisions/1`)));
  });

  test("no client (including active members) can read settlementOperations", async () => {
    await bootstrapGroupAndMembers();

    const aliceDb = testEnv.authenticatedContext(aliceId, { email: aliceEmail }).firestore();
    await assertFails(getDoc(doc(aliceDb, `groups/${groupId}/settlementOperations/op-1`)));

    const bobDb = testEnv.authenticatedContext(bobId, { email: bobEmail }).firestore();
    await assertFails(getDoc(doc(bobDb, `groups/${groupId}/settlementOperations/op-1`)));
  });
});
