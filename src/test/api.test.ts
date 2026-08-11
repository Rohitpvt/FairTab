import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { auth } from "../infrastructure/firebase/firebase";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import type { VercelRequest, VercelResponse } from "@vercel/node";

async function executeVercelHandler(
  handler: any,
  reqOpts: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  }
) {
  let status = 200;
  let jsonPayload: any = null;
  let ended = false;

  const req = {
    method: reqOpts.method || "POST",
    headers: reqOpts.headers || {},
    body: reqOpts.body || {},
  } as unknown as VercelRequest;

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
  } as unknown as VercelResponse;

  await handler(req, res);
  return { status, body: jsonPayload };
}

describe("Vercel Serverless Backend API Validation Tests", () => {
  let testEnv: RulesTestEnvironment;
  const aliceEmail = "alice.api@example.com";
  const alicePassword = "password123";
  let aliceUid = "";

  const bobEmail = "bob.api@example.com";
  const bobPassword = "password123";
  let bobUid = "";

  const charlieEmail = "charlie.api@example.com"; // Viewer member
  const charliePassword = "password123";
  let charlieUid = "";

  const groupId = "group-api-test";
  const archivedGroupId = "group-api-archived-test";

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "mock-project-id",
      firestore: { host: "127.0.0.1", port: 8080 },
    });

    await signOut(auth);

    // Bootstrap users
    try {
      const credA = await createUserWithEmailAndPassword(auth, aliceEmail, alicePassword);
      aliceUid = credA.user.uid;
    } catch {
      const credA = await signInWithEmailAndPassword(auth, aliceEmail, alicePassword);
      aliceUid = credA.user.uid;
    }

    try {
      const credB = await createUserWithEmailAndPassword(auth, bobEmail, bobPassword);
      bobUid = credB.user.uid;
    } catch {
      const credB = await signInWithEmailAndPassword(auth, bobEmail, bobPassword);
      bobUid = credB.user.uid;
    }
    void bobUid;

    try {
      const credC = await createUserWithEmailAndPassword(auth, charlieEmail, charliePassword);
      charlieUid = credC.user.uid;
    } catch {
      const credC = await signInWithEmailAndPassword(auth, charlieEmail, charliePassword);
      charlieUid = credC.user.uid;
    }

    // Bootstrap Firestore groups, members, indices
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      
      // Active group
      await setDoc(doc(db, "groups", groupId), {
        id: groupId,
        name: "API Test Group",
        baseCurrency: "USD",
        ownerUserId: aliceUid,
        status: "active",
        memberUserIds: [aliceUid, charlieUid],
      });
      await setDoc(doc(db, `groups/${groupId}/members`, aliceUid), {
        id: aliceUid,
        role: "owner",
        status: "active",
      });
      await setDoc(doc(db, `groups/${groupId}/members`, charlieUid), {
        id: charlieUid,
        role: "viewer",
        status: "active",
      });

      // Archived group
      await setDoc(doc(db, "groups", archivedGroupId), {
        id: archivedGroupId,
        name: "Archived Group",
        baseCurrency: "USD",
        ownerUserId: aliceUid,
        status: "archived",
        memberUserIds: [aliceUid],
      });
      await setDoc(doc(db, `groups/${archivedGroupId}/members`, aliceUid), {
        id: aliceUid,
        role: "owner",
        status: "active",
      });
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  describe("API Authentication (JWT Validation)", () => {
    test("fails when authorization header is missing", async () => {
      const handler = (await import("../../api/expenses/create.js")).default;
      const res = await executeVercelHandler(handler, {});
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("unauthenticated");
    });

    test("fails when authorization token format is invalid", async () => {
      const handler = (await import("../../api/expenses/create.js")).default;
      const res = await executeVercelHandler(handler, {
        headers: { authorization: "Bearer invalid-token-string" }
      });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("unauthenticated");
    });
  });

  describe("Group Membership & Role Permissions", () => {
    test("rejects mutation when user is a non-member", async () => {
      await signInWithEmailAndPassword(auth, bobEmail, bobPassword);
      const handler = (await import("../../api/expenses/create.js")).default;
      const token = await auth.currentUser?.getIdToken();

      const res = await executeVercelHandler(handler, {
        headers: { authorization: `Bearer ${token}` },
        body: {
          clientOperationId: "op-non-member",
          groupId,
          expenseId: "exp-non-member",
          title: "Dinner",
          category: "food",
          incurredAtSeconds: Math.floor(Date.now() / 1000),
          currency: "USD",
          amountMinor: 100,
          fxNumerator: 1,
          fxDenominator: 1,
          splitMethod: "equal",
          payers: [{ memberId: bobUid, amountMinor: 100 }],
          splits: [{ memberId: bobUid, amountMinor: 100 }],
        }
      });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("permission-denied");
    });

    test("rejects mutation when user is a viewer in the group", async () => {
      await signInWithEmailAndPassword(auth, charlieEmail, charliePassword);
      const handler = (await import("../../api/expenses/create.js")).default;
      const token = await auth.currentUser?.getIdToken();

      const res = await executeVercelHandler(handler, {
        headers: { authorization: `Bearer ${token}` },
        body: {
          clientOperationId: "op-viewer-member",
          groupId,
          expenseId: "exp-viewer-member",
          title: "Dinner",
          category: "food",
          incurredAtSeconds: Math.floor(Date.now() / 1000),
          currency: "USD",
          amountMinor: 100,
          fxNumerator: 1,
          fxDenominator: 1,
          splitMethod: "equal",
          payers: [{ memberId: charlieUid, amountMinor: 100 }],
          splits: [{ memberId: charlieUid, amountMinor: 100 }],
        }
      });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("permission-denied");
    });

    test("rejects mutation when target group is archived or deleted", async () => {
      await signInWithEmailAndPassword(auth, aliceEmail, alicePassword);
      const handler = (await import("../../api/expenses/create.js")).default;
      const token = await auth.currentUser?.getIdToken();

      const res = await executeVercelHandler(handler, {
        headers: { authorization: `Bearer ${token}` },
        body: {
          clientOperationId: "op-archived-group",
          groupId: archivedGroupId,
          expenseId: "exp-archived-group",
          title: "Dinner",
          category: "food",
          incurredAtSeconds: Math.floor(Date.now() / 1000),
          currency: "USD",
          amountMinor: 100,
          fxNumerator: 1,
          fxDenominator: 1,
          splitMethod: "equal",
          payers: [{ memberId: aliceUid, amountMinor: 100 }],
          splits: [{ memberId: aliceUid, amountMinor: 100 }],
        }
      });
      expect(res.status).toBe(412);
      expect(res.body.code).toBe("failed-precondition");
    });
  });

  describe("Receipt S3 Signing Validations", () => {
    test("presign-upload rejects invalid MIME file types", async () => {
      await signInWithEmailAndPassword(auth, aliceEmail, alicePassword);
      const handler = (await import("../../api/receipts/presign-upload.js")).default;
      const token = await auth.currentUser?.getIdToken();

      const res = await executeVercelHandler(handler, {
        headers: { authorization: `Bearer ${token}` },
        body: {
          groupId,
          receiptId: "rec-mime-test",
          fileName: "malicious.exe",
          fileType: "application/x-msdownload",
        }
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("invalid-argument");
    });

    test("presign-upload creates upload policy for valid MIME types", async () => {
      await signInWithEmailAndPassword(auth, aliceEmail, alicePassword);
      const handler = (await import("../../api/receipts/presign-upload.js")).default;
      const token = await auth.currentUser?.getIdToken();

      const res = await executeVercelHandler(handler, {
        headers: { authorization: `Bearer ${token}` },
        body: {
          groupId,
          receiptId: "rec-mime-valid",
          fileName: "receipt.png",
          fileType: "image/png",
        }
      });
      expect(res.status).toBe(200);
      expect(res.body.url).toBeDefined();
      expect(res.body.objectKey).toContain("groups/group-api-test/receipts/rec-mime-valid/v1/receipt.png");
    });
  });
});
