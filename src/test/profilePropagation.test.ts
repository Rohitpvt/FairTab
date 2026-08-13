/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { auth } from "../infrastructure/firebase/firebase";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";

async function executeVercelHandler(
  handler: any,
  reqOpts: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: any;
  }
) {
  let status = 200;
  let jsonPayload: any = null;
  let ended = false;

  const req = {
    method: reqOpts.method || "POST",
    url: reqOpts.url || "/api/accounts/update-profile",
    headers: reqOpts.headers || {},
    body: reqOpts.body || {},
  } as any;

  const res = {
    setHeader: () => {},
    status: (code: number) => {
      status = code;
      return res;
    },
    json: (payload: any) => {
      jsonPayload = payload;
      ended = true;
      return res;
    },
    end: () => {
      ended = true;
      return res;
    },
    get writableEnded() {
      return ended;
    }
  } as any;

  await handler(req, res);

  if (status >= 400) {
    const error: any = new Error(jsonPayload?.message || "Vercel API error");
    error.code = jsonPayload?.code || "unknown";
    error.details = jsonPayload?.details || null;
    error.status = status;
    throw error;
  }

  return jsonPayload;
}

describe("Username Propagation & Profile Update Tests", () => {
  let testEnv: RulesTestEnvironment;
  const testEmail = "testprop.user@example.com";
  const testPassword = "password123";
  let testUid = "";
  const groupId = "prop-test-group";

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "mock-project-id",
      firestore: {
        host: "127.0.0.1",
        port: 8080,
      },
    });

    try {
      const userCred = await createUserWithEmailAndPassword(auth, testEmail, testPassword);
      testUid = userCred.user.uid;
    } catch {
      const userCred = await signInWithEmailAndPassword(auth, testEmail, testPassword);
      testUid = userCred.user.uid;
    }
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      // Bootstrap user profile
      await setDoc(doc(db, "users", testUid), {
        uid: testUid,
        displayName: "Old Name",
        displayNameLower: "old name",
        email: testEmail,
        photoURL: "",
        defaultCurrency: "INR",
        locale: "en-IN",
        timeZone: "Asia/Kolkata",
        onboardingCompleted: true,
        accountStatus: "active",
        createdAt: new Date(),
        createdBy: testUid,
        updatedAt: new Date(),
        updatedBy: testUid,
        version: 1,
        schemaVersion: 1,
      });

      // Bootstrap group
      await setDoc(doc(db, "groups", groupId), {
        id: groupId,
        name: "Propagation Group",
        nameLower: "propagation group",
        baseCurrency: "INR",
        ownerUserId: testUid,
        memberUserIds: [testUid],
        activeMemberCount: 1,
        simplifyDebts: true,
        settlementStrategy: "minimum_transactions",
        status: "active",
        version: 1,
        schemaVersion: 1,
      });

      // Bootstrap user's membership
      await setDoc(doc(db, `groups/${groupId}/members`, testUid), {
        id: testUid,
        groupId,
        kind: "account",
        userId: testUid,
        displayName: "Old Name",
        displayNameLower: "old name",
        role: "owner",
        status: "active",
        version: 1,
        schemaVersion: 1,
      });

      // Bootstrap userGroupIndex entry
      await setDoc(doc(db, `userGroupIndex/${testUid}/groups`, groupId), {
        groupId,
        groupName: "Propagation Group",
        role: "owner",
        status: "active",
        latestActivityAt: new Date(),
        updatedAt: new Date(),
      });
    });
  });

  test("handleUpdateProfile updates profile document, auth profile, and propagates to memberships", async () => {
    const handler = (await import("../../api/index.js")).default;
    const token = await auth.currentUser?.getIdToken();

    // Call update profile backend Vercel route
    const res = await executeVercelHandler(handler, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: {
        displayName: "New Name"
      }
    });

    expect(res.success).toBe(true);

    // Verify profile document users/{uid} updated
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      
      const userSnap = await getDoc(doc(db, "users", testUid));
      expect(userSnap.exists()).toBe(true);
      expect(userSnap.data()?.displayName).toBe("New Name");
      expect(userSnap.data()?.displayNameLower).toBe("new name");

      // Verify membership displayName propagated
      const memberSnap = await getDoc(doc(db, `groups/${groupId}/members`, testUid));
      expect(memberSnap.exists()).toBe(true);
      expect(memberSnap.data()?.displayName).toBe("New Name");
      expect(memberSnap.data()?.displayNameLower).toBe("new name");
    });
  });

  test("handleRepairProfile updates stale membership cache using live profile", async () => {
    // Set user profile to 'Rohit' and leave membership stale as 'Old Name'
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "users", testUid), {
        uid: testUid,
        displayName: "Rohit",
        displayNameLower: "rohit",
        email: testEmail,
        photoURL: "",
        defaultCurrency: "INR",
        locale: "en-IN",
        timeZone: "Asia/Kolkata",
        onboardingCompleted: true,
        accountStatus: "active",
        createdAt: new Date(),
        createdBy: testUid,
        updatedAt: new Date(),
        updatedBy: testUid,
        version: 1,
        schemaVersion: 1,
      }, { merge: true });
    });

    const handler = (await import("../../api/index.js")).default;
    const token = await auth.currentUser?.getIdToken();

    // Call repair profile backend Vercel route
    const res = await executeVercelHandler(handler, {
      method: "POST",
      url: "/api/accounts/repair-profile",
      headers: { authorization: `Bearer ${token}` },
      body: {}
    });

    expect(res.success).toBe(true);
    expect(res.repairedCount).toBe(1);

    // Verify membership displayName has been repaired to 'Rohit'
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const memberSnap = await getDoc(doc(db, `groups/${groupId}/members`, testUid));
      expect(memberSnap.exists()).toBe(true);
      expect(memberSnap.data()?.displayName).toBe("Rohit");
      expect(memberSnap.data()?.displayNameLower).toBe("rohit");
    });
  });
});
