import { describe, test, beforeAll, afterAll, beforeEach, expect } from "vitest";
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
    projectId: "fairtab-rules-recurring-test",
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

describe("Firestore Security Rules - Recurring Templates & Occurrences", () => {
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

      // Alice (owner)
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

      // Bob (member)
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
    });
  };

  test("direct client writes on recurring templates are strictly denied", async () => {
    await bootstrapGroupAndMembers();
    const ctx = testEnv.authenticatedContext(aliceId);
    const db = ctx.firestore();
    const tRef = doc(db, `groups/${groupId}/recurringTemplates/temp-123`);

    await assertFails(
      setDoc(tRef, {
        id: "temp-123",
        groupId,
        title: "Rent",
        amountMinor: 100000,
        currency: "USD",
        status: "active",
      })
    );
  });

  test("direct client writes on occurrences are strictly denied", async () => {
    await bootstrapGroupAndMembers();
    const ctx = testEnv.authenticatedContext(aliceId);
    const db = ctx.firestore();
    const oRef = doc(
      db,
      `groups/${groupId}/recurringTemplates/temp-123/occurrences/2026-03-01`
    );

    await assertFails(
      setDoc(oRef, {
        id: "2026-03-01",
        templateId: "temp-123",
        groupId,
        status: "pending",
      })
    );
  });

  test("active group members can read templates and occurrences", async () => {
    await bootstrapGroupAndMembers();

    // Seed template & occurrence with security rules disabled
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, `groups/${groupId}/recurringTemplates/temp-123`), {
        id: "temp-123",
        groupId,
        title: "Rent",
        amountMinor: 100000,
        currency: "USD",
        status: "active",
      });

      await setDoc(
        doc(db, `groups/${groupId}/recurringTemplates/temp-123/occurrences/2026-03-01`),
        {
          id: "2026-03-01",
          templateId: "temp-123",
          groupId,
          status: "pending",
        }
      );
    });

    const ctx = testEnv.authenticatedContext(bobId);
    const db = ctx.firestore();

    const tSnap = await assertSucceeds(
      getDoc(doc(db, `groups/${groupId}/recurringTemplates/temp-123`))
    );
    expect(tSnap.exists()).toBe(true);

    const oSnap = await assertSucceeds(
      getDoc(
        doc(db, `groups/${groupId}/recurringTemplates/temp-123/occurrences/2026-03-01`)
      )
    );
    expect(oSnap.exists()).toBe(true);
  });

  test("non-members and unauthenticated users cannot read templates or occurrences", async () => {
    await bootstrapGroupAndMembers();

    // Seed
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, `groups/${groupId}/recurringTemplates/temp-123`), {
        id: "temp-123",
        groupId,
        title: "Rent",
      });
    });

    // Unauthenticated
    const unauthCtx = testEnv.unauthenticatedContext();
    const unauthDb = unauthCtx.firestore();
    await assertFails(
      getDoc(doc(unauthDb, `groups/${groupId}/recurringTemplates/temp-123`))
    );

    // Non-member Charlie
    const charlieCtx = testEnv.authenticatedContext(charlieId);
    const charlieDb = charlieCtx.firestore();
    await assertFails(
      getDoc(doc(charlieDb, `groups/${groupId}/recurringTemplates/temp-123`))
    );
  });
});
