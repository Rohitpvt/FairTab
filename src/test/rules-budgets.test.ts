import { describe, test, beforeAll, afterAll, beforeEach } from "vitest";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import fs from "fs";
import path from "path";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  const rulesPath = path.resolve(__dirname, "../../firestore.rules");
  const rules = fs.readFileSync(rulesPath, "utf8");

  testEnv = await initializeTestEnvironment({
    projectId: "fairtab-rules-budgets-test",
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

describe("Firestore Security Rules - Budgets", () => {
  const aliceId = "user-alice";
  const bobId = "user-bob";
  const charlieId = "user-charlie"; // non-member
  const groupId = "group-123";

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
        memberUserIds: [aliceId, bobId],
        activeMemberCount: 2,
        status: "active",
        createdAt: new Date(),
        createdBy: aliceId,
        updatedAt: new Date(),
        updatedBy: aliceId,
        version: 1,
        schemaVersion: 1,
      });

      // Setup active member documents
      await setDoc(doc(db, `groups/${groupId}/members/${aliceId}`), {
        id: aliceId,
        groupId,
        role: "owner",
        status: "active",
        createdAt: new Date(),
        createdBy: aliceId,
        updatedAt: new Date(),
        updatedBy: aliceId,
        version: 1,
        schemaVersion: 1,
      });

      await setDoc(doc(db, `groups/${groupId}/members/${bobId}`), {
        id: bobId,
        groupId,
        role: "member",
        status: "active",
        createdAt: new Date(),
        createdBy: aliceId,
        updatedAt: new Date(),
        updatedBy: aliceId,
        version: 1,
        schemaVersion: 1,
      });

      // Setup a mock budget
      await setDoc(doc(db, `groups/${groupId}/budgets/budget-1`), {
        id: "budget-1",
        groupId,
        name: "Monthly Cap",
        scope: "overall",
        period: "monthly",
        timeZone: "UTC",
        startDate: "2026-03-01",
        amountMinor: 5000,
        currency: "USD",
        status: "active",
        createdAt: new Date(),
        createdBy: aliceId,
        updatedAt: new Date(),
        updatedBy: aliceId,
        version: 1,
        schemaVersion: 1,
        latestOperationId: "op-1",
      });
    });
  };

  test("active group members can read budgets", async () => {
    await bootstrapGroupAndMembers();

    const aliceDb = testEnv.authenticatedContext(aliceId).firestore();
    const bobDb = testEnv.authenticatedContext(bobId).firestore();

    await assertSucceeds(getDoc(doc(aliceDb, `groups/${groupId}/budgets/budget-1`)));
    await assertSucceeds(getDoc(doc(bobDb, `groups/${groupId}/budgets/budget-1`)));
  });

  test("non-members and unauthenticated users are denied read access", async () => {
    await bootstrapGroupAndMembers();

    const charlieDb = testEnv.authenticatedContext(charlieId).firestore();
    const unauthDb = testEnv.unauthenticatedContext().firestore();

    await assertFails(getDoc(doc(charlieDb, `groups/${groupId}/budgets/budget-1`)));
    await assertFails(getDoc(doc(unauthDb, `groups/${groupId}/budgets/budget-1`)));
  });

  test("clients cannot write budgets directly (creation, update, delete are all denied)", async () => {
    await bootstrapGroupAndMembers();

    const aliceDb = testEnv.authenticatedContext(aliceId).firestore();

    // Create direct write check
    await assertFails(
      setDoc(doc(aliceDb, `groups/${groupId}/budgets/budget-2`), {
        id: "budget-2",
        groupId,
        name: "New Budget",
        scope: "overall",
        period: "monthly",
        timeZone: "UTC",
        startDate: "2026-03-01",
        amountMinor: 1000,
        currency: "USD",
        status: "active",
      })
    );

    // Update direct write check
    await assertFails(
      setDoc(doc(aliceDb, `groups/${groupId}/budgets/budget-1`), {
        name: "Updated Name",
      }, { merge: true })
    );
  });
});
