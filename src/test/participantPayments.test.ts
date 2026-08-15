process.env.GCLOUD_PROJECT = "mock-project-id";
process.env.GCP_PROJECT_ID = "mock-project-id";
process.env.VITE_FIREBASE_PROJECT_ID = "mock-project-id";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { auth } from "../infrastructure/firebase/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { SettlementDocument, ParticipantPaymentDocument } from "@fairtab/domain";

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

  if (status >= 400) {
    const error: any = new Error(jsonPayload?.message || "Vercel API error");
    error.code = jsonPayload?.code || "unknown";
    error.details = jsonPayload?.details || null;
    error.status = status;
    throw error;
  }

  return jsonPayload;
}

describe("Integration: Participant Payment Status & Proportional Splits", () => {
  let testEnv: RulesTestEnvironment;
  const groupId = "grp-payment-test";
  const expenseId = "exp-payment-test";

  const aliceEmail = "alice.pay@example.com";
  const bobEmail = "bob.pay@example.com";
  const charlieEmail = "charlie.pay@example.com";
  const password = "password123";

  let aliceId = "";
  let bobId = "";
  let charlieId = "";
  const placeholderId = "placeholder-david";

  const settleExpenseSplitFn = async (data: any) => {
    const handler = (await import("../../api/settlements/settle-split.js")).default;
    const token = await auth.currentUser?.getIdToken();
    return executeVercelHandler(handler, {
      headers: { authorization: `Bearer ${token}` },
      body: data,
    });
  };

  const unsettleExpenseSplitFn = async (data: any) => {
    const handler = (await import("../../api/settlements/unsettle-split.js")).default;
    const token = await auth.currentUser?.getIdToken();
    return executeVercelHandler(handler, {
      headers: { authorization: `Bearer ${token}` },
      body: data,
    });
  };

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "mock-project-id",
      firestore: {
        host: "127.0.0.1",
        port: 8080,
      },
    });

    await testEnv.clearFirestore();

    // Create real Auth users
    await signOut(auth);

    try {
      const u = await createUserWithEmailAndPassword(auth, aliceEmail, password);
      aliceId = u.user.uid;
    } catch {
      const u = await signInWithEmailAndPassword(auth, aliceEmail, password);
      aliceId = u.user.uid;
    }

    try {
      const u = await createUserWithEmailAndPassword(auth, bobEmail, password);
      bobId = u.user.uid;
    } catch {
      const u = await signInWithEmailAndPassword(auth, bobEmail, password);
      bobId = u.user.uid;
    }

    try {
      const u = await createUserWithEmailAndPassword(auth, charlieEmail, password);
      charlieId = u.user.uid;
    } catch {
      const u = await signInWithEmailAndPassword(auth, charlieEmail, password);
      charlieId = u.user.uid;
    }

    // Bootstrap data with rules disabled
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const dbAdmin = context.firestore();

      // Seed Group Document
      await setDoc(doc(dbAdmin, "groups", groupId), {
        id: groupId,
        name: "Payment Test Group",
        status: "active",
        baseCurrency: "USD",
        ownerUserId: aliceId,
        memberUserIds: [aliceId, bobId, charlieId],
        activeMemberCount: 4,
        version: 1,
        createdAt: new Date(),
      });

      // Seed active members
      await setDoc(doc(dbAdmin, `groups/${groupId}/members`, aliceId), {
        id: aliceId,
        userId: aliceId,
        role: "owner",
        status: "active",
        kind: "account",
      });

      await setDoc(doc(dbAdmin, `groups/${groupId}/members`, bobId), {
        id: bobId,
        userId: bobId,
        role: "member",
        status: "active",
        kind: "account",
      });

      await setDoc(doc(dbAdmin, `groups/${groupId}/members`, charlieId), {
        id: charlieId,
        userId: charlieId,
        role: "member",
        status: "active",
        kind: "account",
      });

      await setDoc(doc(dbAdmin, `groups/${groupId}/members`, placeholderId), {
        id: placeholderId,
        role: "member",
        status: "active",
        kind: "placeholder",
      });

      // Seed Expense Document
      // Multi-payer: Alice paid 3000, Bob paid 1000. Total = 4000 USD
      // Splits: Alice 1000, Bob 1000, Charlie 1000, David 1000
      await setDoc(doc(dbAdmin, `groups/${groupId}/expenses`, expenseId), {
        id: expenseId,
        groupId,
        title: "Multi-payer Dinner",
        category: "food",
        currency: "USD",
        amountMinor: 4000,
        baseAmountMinor: 4000,
        fx: { mode: "same_currency", numerator: 1, denominator: 1 },
        status: "active",
        payers: [
          { memberId: aliceId, amountMinor: 3000, baseAmountMinor: 3000 },
          { memberId: bobId, amountMinor: 1000, baseAmountMinor: 1000 },
        ],
        splits: [
          { memberId: aliceId, amountMinor: 1000, baseAmountMinor: 1000 },
          { memberId: bobId, amountMinor: 1000, baseAmountMinor: 1000 },
          { memberId: charlieId, amountMinor: 1000, baseAmountMinor: 1000 },
          { memberId: placeholderId, amountMinor: 1000, baseAmountMinor: 1000 },
        ],
        payerMemberIds: [aliceId, bobId],
        participantMemberIds: [aliceId, bobId, charlieId, placeholderId],
        createdBy: aliceId,
        createdAt: new Date(),
        version: 1,
      });
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  test(
    "owner marking Charlie (debtor) paid creates proportional settlement and tracking record",
    async () => {
      // Authenticate as Alice (Owner of Group)
      await signInWithEmailAndPassword(auth, aliceEmail, password);

      const clientOperationId = "op-settle-charlie-paid";
      await settleExpenseSplitFn({
        clientOperationId,
        groupId,
        expenseId,
        memberId: charlieId,
      });

      // Verify database state using rules-disabled admin context
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const dbAdmin = context.firestore();
        const trackingSnap = await getDoc(doc(dbAdmin, "groups", groupId, "expenses", expenseId, "payments", charlieId));
        expect(trackingSnap.exists()).toBe(true);
        const trackingData = trackingSnap.data() as ParticipantPaymentDocument;
        expect(trackingData.status).toBe("paid");
        expect(trackingData.settlementIds).toHaveLength(1);

        const settlementId = trackingData.settlementIds[0];
        expect(settlementId).toBe(`${expenseId}_${charlieId}_${aliceId}`);

        // Check actual SettlementDocument
        const setSnap = await getDoc(doc(dbAdmin, "groups", groupId, "settlements", settlementId));
        expect(setSnap.exists()).toBe(true);
        const setData = setSnap.data() as SettlementDocument;
        expect(setData.status).toBe("active");
        expect(setData.payerId).toBe(charlieId);
        expect(setData.receiverId).toBe(aliceId);
        expect(setData.amountMinor).toBe(1000);
        expect(setData.relatedExpenseId).toBe(expenseId);
        expect(setData.relatedMemberId).toBe(charlieId);
      });
    },
    20000
  );

  test("marking the same participant split paid twice is idempotent and does not duplicate", async () => {
    await signInWithEmailAndPassword(auth, aliceEmail, password);

    const clientOperationId = "op-settle-charlie-paid-retry";
    await settleExpenseSplitFn({
      clientOperationId,
      groupId,
      expenseId,
      memberId: charlieId,
    });

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const dbAdmin = context.firestore();
      const trackingSnap = await getDoc(doc(dbAdmin, "groups", groupId, "expenses", expenseId, "payments", charlieId));
      const trackingData = trackingSnap.data() as ParticipantPaymentDocument;
      expect(trackingData.status).toBe("paid");
      expect(trackingData.settlementIds).toHaveLength(1);
    });
  });

  test("unauthorized user cannot mark splits paid", async () => {
    // Authenticate as Bob (member, but not group owner or admin or expense creator)
    await signInWithEmailAndPassword(auth, bobEmail, password);

    const clientOperationId = "op-settle-unauth";
    await expect(
      settleExpenseSplitFn({
        clientOperationId,
        groupId,
        expenseId,
        memberId: placeholderId,
      })
    ).rejects.toThrow("You are not authorized to mark this participant split as paid.");
  });

  test("authorized user unmarking paid voids only linked settlements", async () => {
    await signInWithEmailAndPassword(auth, aliceEmail, password);

    let linkedSettlementId = "";
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const dbAdmin = context.firestore();
      const trackingSnapBefore = await getDoc(doc(dbAdmin, "groups", groupId, "expenses", expenseId, "payments", charlieId));
      const trackingDataBefore = trackingSnapBefore.data() as ParticipantPaymentDocument;
      linkedSettlementId = trackingDataBefore.settlementIds[0];
    });

    const clientOperationId = "op-unsettle-charlie";
    await unsettleExpenseSplitFn({
      clientOperationId,
      groupId,
      expenseId,
      memberId: charlieId,
    });

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const dbAdmin = context.firestore();
      const trackingSnapAfter = await getDoc(doc(dbAdmin, "groups", groupId, "expenses", expenseId, "payments", charlieId));
      const trackingDataAfter = trackingSnapAfter.data() as ParticipantPaymentDocument;
      expect(trackingDataAfter.status).toBe("unpaid");

      const setSnap = await getDoc(doc(dbAdmin, "groups", groupId, "settlements", linkedSettlementId));
      const setData = setSnap.data() as SettlementDocument;
      expect(setData.status).toBe("voided");
    });
  });
});
