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
  signOut,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
} from "firebase/firestore";
import type { ExpenseDocument } from "@fairtab/domain";
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

  if (status >= 400) {
    const error: any = new Error(jsonPayload?.message || "Vercel API error");
    error.code = jsonPayload?.code || "unknown";
    error.details = jsonPayload?.details || null;
    error.status = status;
    throw error;
  }

  return jsonPayload;
}

describe("Cloud Functions Integration Tests", () => {
  let testEnv: RulesTestEnvironment;
  const aliceEmail = "alice.func@example.com";
  const alicePassword = "password123";
  let aliceUid = "";

  const bobEmail = "bob.func@example.com";
  const bobPassword = "password123";
  let bobUid = "";

  const charlieEmail = "charlie.func@example.com";
  const charliePassword = "password123";
  let charlieUid = "";

  const groupId = "group-func-test";
  
  const createExpenseFn = async (data: any) => {
    const handler = (await import("../../api/expenses/create.js")).default;
    const token = await auth.currentUser?.getIdToken();
    const res = await executeVercelHandler(handler, {
      headers: { authorization: `Bearer ${token}` },
      body: data
    });
    return { data: res };
  };

  const updateExpenseFn = async (data: any) => {
    const handler = (await import("../../api/expenses/update.js")).default;
    const token = await auth.currentUser?.getIdToken();
    const res = await executeVercelHandler(handler, {
      headers: { authorization: `Bearer ${token}` },
      body: data
    });
    return { data: res };
  };

  const voidExpenseFn = async (data: any) => {
    const handler = (await import("../../api/expenses/void.js")).default;
    const token = await auth.currentUser?.getIdToken();
    const res = await executeVercelHandler(handler, {
      headers: { authorization: `Bearer ${token}` },
      body: data
    });
    return { data: res };
  };

  beforeAll(async () => {
    // Start Rules Test Environment to bootstrap database with rules disabled
    testEnv = await initializeTestEnvironment({
      projectId: "mock-project-id", // must match client SDK project ID
      firestore: {
        host: "127.0.0.1",
        port: 8080,
      },
    });

    // Clear auth and create test users
    await signOut(auth);
    
    // Create Alice
    try {
      const userCred = await createUserWithEmailAndPassword(auth, aliceEmail, alicePassword);
      aliceUid = userCred.user.uid;
    } catch {
      const userCred = await signInWithEmailAndPassword(auth, aliceEmail, alicePassword);
      aliceUid = userCred.user.uid;
    }

    // Create Bob
    try {
      const userCred = await createUserWithEmailAndPassword(auth, bobEmail, bobPassword);
      bobUid = userCred.user.uid;
    } catch {
      const userCred = await signInWithEmailAndPassword(auth, bobEmail, bobPassword);
      bobUid = userCred.user.uid;
    }

    // Create Charlie (viewer/non-creator member)
    try {
      const userCred = await createUserWithEmailAndPassword(auth, charlieEmail, charliePassword);
      charlieUid = userCred.user.uid;
    } catch {
      const userCred = await signInWithEmailAndPassword(auth, charlieEmail, charliePassword);
      charlieUid = userCred.user.uid;
    }
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();

    // Bootstrap group, members, and profiles in Firestore with rules disabled
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      
      const groupRef = doc(db, "groups", groupId);
      await setDoc(groupRef, {
        id: groupId,
        name: "Function Test Group",
        nameLower: "function test group",
        baseCurrency: "USD",
        ownerUserId: aliceUid,
        memberUserIds: [aliceUid, bobUid, charlieUid],
        activeMemberCount: 3,
        simplifyDebts: true,
        settlementStrategy: "minimum_transactions",
        status: "active",
        version: 1,
        schemaVersion: 1,
      });

      // Alice: owner
      await setDoc(doc(db, `groups/${groupId}/members`, aliceUid), {
        id: aliceUid,
        groupId,
        kind: "account",
        userId: aliceUid,
        displayName: "Alice Owner",
        displayNameLower: "alice owner",
        role: "owner",
        status: "active",
        version: 1,
        schemaVersion: 1,
      });

      // Bob: member
      await setDoc(doc(db, `groups/${groupId}/members`, bobUid), {
        id: bobUid,
        groupId,
        kind: "account",
        userId: bobUid,
        displayName: "Bob Member",
        displayNameLower: "bob member",
        role: "member",
        status: "active",
        version: 1,
        schemaVersion: 1,
      });

      // Charlie: viewer
      await setDoc(doc(db, `groups/${groupId}/members`, charlieUid), {
        id: charlieUid,
        groupId,
        kind: "account",
        userId: charlieUid,
        displayName: "Charlie Viewer",
        displayNameLower: "charlie viewer",
        role: "viewer",
        status: "active",
        version: 1,
        schemaVersion: 1,
      });
    });
  });

  test("createExpense succeeds for owners and validates calculations", async () => {
    // Sign in as Alice (owner)
    await signInWithEmailAndPassword(auth, aliceEmail, alicePassword);

    const clientOperationId = "op-create-1";
    const expenseId = "exp-create-1";

    const payload = {
      clientOperationId,
      groupId,
      expenseId,
      title: "Shared Taxi",
      category: "transport",
      incurredAtSeconds: Math.floor(Date.now() / 1000),
      currency: "USD",
      amountMinor: 3000, // $30.00
      fxNumerator: 1,
      fxDenominator: 1,
      splitMethod: "equal",
      payers: [
        { memberId: aliceUid, amountMinor: 3000 },
      ],
      splits: [
        { memberId: aliceUid, amountMinor: 1000 },
        { memberId: bobUid, amountMinor: 1000 },
        { memberId: charlieUid, amountMinor: 1000 },
      ],
    };

    const res = await createExpenseFn(payload);
    expect(res.data.expenseId).toBe(expenseId);
    expect(res.data.version).toBe(1);

    // Verify written documents in Firestore using rules disabled context to bypass read restrictions
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const expenseSnap = await getDoc(doc(db, `groups/${groupId}/expenses/${expenseId}`));
      expect(expenseSnap.exists()).toBe(true);
      const expData = expenseSnap.data() as ExpenseDocument;
      expect(expData.title).toBe("Shared Taxi");
      expect(expData.version).toBe(1);
      expect(expData.createdBy).toBe(aliceUid);

      // Verify immutable revision exists
      const revSnap = await getDoc(doc(db, `groups/${groupId}/expenses/${expenseId}/revisions/1`));
      expect(revSnap.exists()).toBe(true);

      // Verify activity was logged
      const activitiesSnap = await getDocs(collection(db, `groups/${groupId}/activities`));
      const createdAct = activitiesSnap.docs.find((d) => d.data().type === "expense_created");
      expect(createdAct).toBeDefined();
      expect(createdAct?.data().summary).toContain("Shared Taxi");
    });
  });

  test("createExpense enforces idempotency keys", async () => {
    await signInWithEmailAndPassword(auth, aliceEmail, alicePassword);

    const clientOperationId = "op-create-idem";
    const expenseId = "exp-create-idem";

    const payload = {
      clientOperationId,
      groupId,
      expenseId,
      title: "Idempotent Lunch",
      category: "food",
      incurredAtSeconds: Math.floor(Date.now() / 1000),
      currency: "USD",
      amountMinor: 1500,
      fxNumerator: 1,
      fxDenominator: 1,
      splitMethod: "equal",
      payers: [{ memberId: aliceUid, amountMinor: 1500 }],
      splits: [
        { memberId: aliceUid, amountMinor: 500 },
        { memberId: bobUid, amountMinor: 500 },
        { memberId: charlieUid, amountMinor: 500 },
      ],
    };

    // First call: succeeds
    const res1 = await createExpenseFn(payload);
    expect(res1.data.version).toBe(1);

    // Second call with EXACT SAME payload: returns cached version
    const res2 = await createExpenseFn(payload);
    expect(res2.data.version).toBe(1);

    // Third call with SAME clientOperationId but DIFFERENT payload: must fail
    const dirtyPayload = { ...payload, amountMinor: 9999 };
    await expect(createExpenseFn(dirtyPayload)).rejects.toThrow();
  });

  test("createExpense blocks viewers and invalid splits", async () => {
    // 1. Viewer role write check
    await signInWithEmailAndPassword(auth, charlieEmail, charliePassword);
    const payload = {
      clientOperationId: "op-create-viewer",
      groupId,
      expenseId: "exp-create-viewer",
      title: "Viewer Try",
      category: "food",
      incurredAtSeconds: Math.floor(Date.now() / 1000),
      currency: "USD",
      amountMinor: 1500,
      fxNumerator: 1,
      fxDenominator: 1,
      splitMethod: "equal",
      payers: [{ memberId: aliceUid, amountMinor: 1500 }],
      splits: [
        { memberId: aliceUid, amountMinor: 500 },
        { memberId: bobUid, amountMinor: 500 },
        { memberId: charlieUid, amountMinor: 500 },
      ],
    };
    await expect(createExpenseFn(payload)).rejects.toThrow(/permitted|permission/i);

    // 2. Invalid split verification (sum doesn't match amount)
    await signInWithEmailAndPassword(auth, aliceEmail, alicePassword);
    const invalidSplitPayload = {
      ...payload,
      clientOperationId: "op-create-invalid",
      expenseId: "exp-create-invalid",
      splits: [
        { memberId: aliceUid, amountMinor: 100 }, // sum 100 != 1500
      ],
    };
    await expect(createExpenseFn(invalidSplitPayload)).rejects.toThrow(/argument|match/i);
  });

  test("updateExpense succeeds for owner and enforces version locking", async () => {
    // Create an initial expense first
    await signInWithEmailAndPassword(auth, aliceEmail, alicePassword);
    const expenseId = "exp-update-lock";
    const payload = {
      clientOperationId: "op-update-lock-init",
      groupId,
      expenseId,
      title: "Initial Dinner",
      category: "food",
      incurredAtSeconds: Math.floor(Date.now() / 1000),
      currency: "USD",
      amountMinor: 2000,
      fxNumerator: 1,
      fxDenominator: 1,
      splitMethod: "equal",
      payers: [{ memberId: aliceUid, amountMinor: 2000 }],
      splits: [
        { memberId: aliceUid, amountMinor: 1000 },
        { memberId: bobUid, amountMinor: 1000 },
      ],
    };
    await createExpenseFn(payload);

    // Sign in as Bob (member)
    await signInWithEmailAndPassword(auth, bobEmail, bobPassword);

    // Bob tries to update it: denied since Bob did not create it
    const updatePayload = {
      ...payload,
      clientOperationId: "op-update-bob-try",
      expectedVersion: 1,
      title: "Bob Edit Try",
    };
    await expect(updateExpenseFn(updatePayload)).rejects.toThrow(/permission|created/i);

    // Sign back in as Alice (creator & owner)
    await signInWithEmailAndPassword(auth, aliceEmail, alicePassword);

    // Update with wrong expectedVersion: returns conflict (aborted)
    const updateConfPayload = {
      ...payload,
      clientOperationId: "op-update-wrong-ver",
      expectedVersion: 99, // Wrong version
      title: "Dinner Premium",
    };
    await expect(updateExpenseFn(updateConfPayload)).rejects.toThrow();

    // Update with correct expectedVersion: succeeds
    const updateOkPayload = {
      ...payload,
      clientOperationId: "op-update-ok",
      expectedVersion: 1,
      title: "Dinner Premium",
    };
    const res = await updateExpenseFn(updateOkPayload);
    expect(res.data.version).toBe(2);

    // Verify Firestore
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const expenseSnap = await getDoc(doc(db, `groups/${groupId}/expenses/${expenseId}`));
      expect(expenseSnap.data()?.title).toBe("Dinner Premium");
      expect(expenseSnap.data()?.version).toBe(2);
    });
  });

  test("voidExpense succeeds and updates revision history", async () => {
    // Create initial expense
    await signInWithEmailAndPassword(auth, aliceEmail, alicePassword);
    const expenseId = "exp-void-test";
    const payload = {
      clientOperationId: "op-void-init",
      groupId,
      expenseId,
      title: "Coffee Run",
      category: "food",
      incurredAtSeconds: Math.floor(Date.now() / 1000),
      currency: "USD",
      amountMinor: 800,
      fxNumerator: 1,
      fxDenominator: 1,
      splitMethod: "equal",
      payers: [{ memberId: aliceUid, amountMinor: 800 }],
      splits: [{ memberId: aliceUid, amountMinor: 800 }],
    };
    await createExpenseFn(payload);

    // Void the expense
    const voidPayload = {
      clientOperationId: "op-void-action",
      groupId,
      expenseId,
      expectedVersion: 1,
      voidReason: "Accidental double input",
    };
    const res = await voidExpenseFn(voidPayload);
    expect(res.data.version).toBe(2);

    // Verify main document void state
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      const expenseSnap = await getDoc(doc(db, `groups/${groupId}/expenses/${expenseId}`));
      const expData = expenseSnap.data() as any;
      expect(expData.status).toBe("voided");
      expect(expData.voidReason).toBe("Accidental double input");

      // Verify revision 2 exists
      const revSnap = await getDoc(doc(db, `groups/${groupId}/expenses/${expenseId}/revisions/2`));
      expect(revSnap.exists()).toBe(true);
      expect(revSnap.data()?.status).toBe("voided");
    });
  });

  test("createExpense rejects writes on archived groups", async () => {
    // 1. Archive the group
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "groups", groupId), {
        status: "archived",
      }, { merge: true });
    });

    await signInWithEmailAndPassword(auth, aliceEmail, alicePassword);

    const payload = {
      clientOperationId: "op-create-archived",
      groupId,
      expenseId: "exp-create-archived",
      title: "Archived Group Try",
      category: "food",
      incurredAtSeconds: Math.floor(Date.now() / 1000),
      currency: "USD",
      amountMinor: 1000,
      fxNumerator: 1,
      fxDenominator: 1,
      splitMethod: "equal",
      payers: [{ memberId: aliceUid, amountMinor: 1000 }],
      splits: [{ memberId: aliceUid, amountMinor: 1000 }],
    };

    await expect(createExpenseFn(payload)).rejects.toThrow(/archived/i);

    // Restore group to active status for other tests
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "groups", groupId), {
        status: "active",
      }, { merge: true });
    });
  });

  test("createExpense validates percentage and shares splits", async () => {
    await signInWithEmailAndPassword(auth, aliceEmail, alicePassword);

    // Percentage splits
    const pctPayload = {
      clientOperationId: "op-pct-split",
      groupId,
      expenseId: "exp-pct-split",
      title: "Percentage Lunch",
      category: "food",
      incurredAtSeconds: Math.floor(Date.now() / 1000),
      currency: "USD",
      amountMinor: 3000,
      fxNumerator: 1,
      fxDenominator: 1,
      splitMethod: "percentage",
      payers: [{ memberId: aliceUid, amountMinor: 3000 }],
      splits: [
        { memberId: aliceUid, amountMinor: 1500, percentageBps: 5000 },
        { memberId: bobUid, amountMinor: 1500, percentageBps: 5000 },
      ],
    };
    const resPct = await createExpenseFn(pctPayload);
    expect(resPct.data.expenseId).toBe("exp-pct-split");

    // Shares splits
    const sharesPayload = {
      clientOperationId: "op-shares-split",
      groupId,
      expenseId: "exp-shares-split",
      title: "Shares Dinner",
      category: "food",
      incurredAtSeconds: Math.floor(Date.now() / 1000),
      currency: "USD",
      amountMinor: 3000,
      fxNumerator: 1,
      fxDenominator: 1,
      splitMethod: "shares",
      payers: [{ memberId: aliceUid, amountMinor: 3000 }],
      splits: [
        { memberId: aliceUid, amountMinor: 1000, shares: 1 },
        { memberId: bobUid, amountMinor: 2000, shares: 2 },
      ],
    };
    const resShares = await createExpenseFn(sharesPayload);
    expect(resShares.data.expenseId).toBe("exp-shares-split");
  });

  test("createExpense rejects payer and split amount mismatches", async () => {
    await signInWithEmailAndPassword(auth, aliceEmail, alicePassword);

    const payload = {
      clientOperationId: "op-mismatch",
      groupId,
      expenseId: "exp-mismatch",
      title: "Mismatch",
      category: "food",
      incurredAtSeconds: Math.floor(Date.now() / 1000),
      currency: "USD",
      amountMinor: 2000,
      fxNumerator: 1,
      fxDenominator: 1,
      splitMethod: "equal",
      payers: [{ memberId: aliceUid, amountMinor: 1500 }], // 1500 != 2000 total
      splits: [
        { memberId: aliceUid, amountMinor: 1000 },
        { memberId: bobUid, amountMinor: 1000 },
      ],
    };
    await expect(createExpenseFn(payload)).rejects.toThrow(/payer|match/i);
  });

  test("createExpense rejects invalid FX rates", async () => {
    await signInWithEmailAndPassword(auth, aliceEmail, alicePassword);

    const payload = {
      clientOperationId: "op-invalid-fx",
      groupId,
      expenseId: "exp-invalid-fx",
      title: "Invalid FX",
      category: "food",
      incurredAtSeconds: Math.floor(Date.now() / 1000),
      currency: "USD",
      amountMinor: 2000,
      fxNumerator: 0, // Invalid
      fxDenominator: 1,
      splitMethod: "equal",
      payers: [{ memberId: aliceUid, amountMinor: 2000 }],
      splits: [
        { memberId: aliceUid, amountMinor: 1000 },
        { memberId: bobUid, amountMinor: 1000 },
      ],
    };
    await expect(createExpenseFn(payload)).rejects.toThrow(/fx|rate|denominator|numerator/i);
  });

  test("createExpense rejects overflow numbers", async () => {
    await signInWithEmailAndPassword(auth, aliceEmail, alicePassword);

    const payload = {
      clientOperationId: "op-overflow",
      groupId,
      expenseId: "exp-overflow",
      title: "Overflow",
      category: "food",
      incurredAtSeconds: Math.floor(Date.now() / 1000),
      currency: "USD",
      // eslint-disable-next-line no-loss-of-precision
      amountMinor: 9999999999999999, // Exceeds MAX_SAFE_INTEGER
      fxNumerator: 1,
      fxDenominator: 1,
      splitMethod: "exact",
      // eslint-disable-next-line no-loss-of-precision
      payers: [{ memberId: aliceUid, amountMinor: 9999999999999999 }],
      splits: [
        { memberId: aliceUid, amountMinor: 4999999999999999 },
        { memberId: bobUid, amountMinor: 5000000000000000 },
      ],
    };
    await expect(createExpenseFn(payload)).rejects.toThrow(/range|overflow|integer/i);
  });

  test("updateExpense returns conflict details with server document on mismatch", async () => {
    await signInWithEmailAndPassword(auth, aliceEmail, alicePassword);

    const expenseId = "exp-conflict-details-test";
    const initPayload = {
      clientOperationId: "op-conflict-details-init",
      groupId,
      expenseId,
      title: "Initial Lunch",
      category: "food",
      incurredAtSeconds: Math.floor(Date.now() / 1000),
      currency: "USD",
      amountMinor: 2000,
      fxNumerator: 1,
      fxDenominator: 1,
      splitMethod: "equal",
      payers: [{ memberId: aliceUid, amountMinor: 2000 }],
      splits: [
        { memberId: aliceUid, amountMinor: 1000 },
        { memberId: bobUid, amountMinor: 1000 },
      ],
    };
    await createExpenseFn(initPayload);

    // Call update with stale/wrong version
    const updatePayload = {
      clientOperationId: "op-conflict-details-update",
      groupId,
      expenseId,
      expectedVersion: 0, // Stale version (should be 1)
      title: "Dinner Edit Conflict",
      category: "food",
      incurredAtSeconds: Math.floor(Date.now() / 1000),
      currency: "USD",
      amountMinor: 2000,
      fxNumerator: 1,
      fxDenominator: 1,
      splitMethod: "equal",
      payers: [{ memberId: aliceUid, amountMinor: 2000 }],
      splits: [
        { memberId: aliceUid, amountMinor: 1000 },
        { memberId: bobUid, amountMinor: 1000 },
      ],
    };

    try {
      await updateExpenseFn(updatePayload);
      expect.fail("Should have failed with conflict error");
    } catch (err: any) {
      expect(err.code).toMatch(/aborted/);
      expect(err.details).toBeDefined();
      expect(err.details.serverDocument).toBeDefined();
      expect(err.details.serverDocument.title).toBe("Initial Lunch");
    }
  });

  describe("Settlement Operations Callables", () => {
    const createSettlementFn = async (data: any) => {
      const handler = (await import("../../api/settlements/create.js")).default;
      const token = await auth.currentUser?.getIdToken();
      const res = await executeVercelHandler(handler, {
        headers: { authorization: `Bearer ${token}` },
        body: data
      });
      return { data: res };
    };

    const voidSettlementFn = async (data: any) => {
      const handler = (await import("../../api/settlements/void.js")).default;
      const token = await auth.currentUser?.getIdToken();
      const res = await executeVercelHandler(handler, {
        headers: { authorization: `Bearer ${token}` },
        body: data
      });
      return { data: res };
    };

    test("createSettlement succeeds for member participant and enforces zero-sum", async () => {
      // Sign in as Bob
      await signInWithEmailAndPassword(auth, bobEmail, bobPassword);

      const settlementId = "set-bob-alice-test";
      const payload = {
        clientOperationId: "op-create-set-1",
        groupId,
        settlementId,
        payerId: bobUid,
        receiverId: aliceUid,
        amountMinor: 1000, // 10.00
        currency: "USD",
        fxNumerator: 1,
        fxDenominator: 1,
      };

      const result = await createSettlementFn(payload);
      expect(result.data.settlementId).toBe(settlementId);
      expect(result.data.version).toBe(1);

      // Verify DB document created
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const snap = await getDoc(doc(db, `groups/${groupId}/settlements/${settlementId}`));
        expect(snap.exists()).toBe(true);
        const data = snap.data()!;
        expect(data.payerId).toBe(bobUid);
        expect(data.receiverId).toBe(aliceUid);
        expect(data.baseAmountMinor).toBe(1000);
        expect(data.status).toBe("active");

        // Verify revision 1 created
        const revSnap = await getDoc(doc(db, `groups/${groupId}/settlements/${settlementId}/revisions/1`));
        expect(revSnap.exists()).toBe(true);

        // Verify receipt created
        const recSnap = await getDoc(doc(db, `groups/${groupId}/settlementOperations/op-create-set-1`));
        expect(recSnap.exists()).toBe(true);
      });
    });

    test("createSettlement blocks non-participant member writes", async () => {
      // Sign in as Charlie (who is member, but NOT alice or bob)
      await signInWithEmailAndPassword(auth, charlieEmail, charliePassword);

      const settlementId = "set-charlie-block-test";
      const payload = {
        clientOperationId: "op-create-set-2",
        groupId,
        settlementId,
        payerId: bobUid,
        receiverId: aliceUid, // Charlie tries to record Bob paying Alice (none of them is Charlie)
        amountMinor: 1000,
        currency: "USD",
        fxNumerator: 1,
        fxDenominator: 1,
      };

      try {
        await createSettlementFn(payload);
        expect.fail("Should have failed with permission-denied");
      } catch (err: any) {
        expect(err.code).toMatch(/permission-denied/);
      }
    });

    test("createSettlement blocks same payer and receiver write", async () => {
      await signInWithEmailAndPassword(auth, bobEmail, bobPassword);

      const settlementId = "set-same-user-test";
      const payload = {
        clientOperationId: "op-create-set-same",
        groupId,
        settlementId,
        payerId: bobUid,
        receiverId: bobUid, // same user
        amountMinor: 1000,
        currency: "USD",
        fxNumerator: 1,
        fxDenominator: 1,
      };

      try {
        await createSettlementFn(payload);
        expect.fail("Should have failed with invalid-argument");
      } catch (err: any) {
        expect(err.code).toMatch(/invalid-argument/);
      }
    });

    test("voidSettlement succeeds for creator-participant and fails for non-creator", async () => {
      // Sign in as Bob, create a settlement
      await signInWithEmailAndPassword(auth, bobEmail, bobPassword);
      const settlementId = "set-void-flow-test";
      const createPayload = {
        clientOperationId: "op-void-flow-create",
        groupId,
        settlementId,
        payerId: bobUid,
        receiverId: aliceUid,
        amountMinor: 500,
        currency: "USD",
        fxNumerator: 1,
        fxDenominator: 1,
      };
      await createSettlementFn(createPayload);

      // Try to void it as Charlie (non-creator, non-participant) -> fail
      await signInWithEmailAndPassword(auth, charlieEmail, charliePassword);
      const voidPayload = {
        clientOperationId: "op-void-flow-void",
        groupId,
        settlementId,
        expectedVersion: 1,
        voidReason: "Accidental settlement",
      };
      try {
        await voidSettlementFn(voidPayload);
        expect.fail("Should have failed with permission-denied");
      } catch (err: any) {
        expect(err.code).toMatch(/permission-denied/);
      }

      // Void it as Bob (creator-participant) -> success
      await signInWithEmailAndPassword(auth, bobEmail, bobPassword);
      const result = await voidSettlementFn(voidPayload);
      expect(result.data.settlementId).toBe(settlementId);
      expect(result.data.version).toBe(2);

      // Verify DB document status is voided
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const snap = await getDoc(doc(db, `groups/${groupId}/settlements/${settlementId}`));
        expect(snap.data()!.status).toBe("voided");
        expect(snap.data()!.voidReason).toBe("Accidental settlement");
      });
    });

    test("voidSettlement enforces expectedVersion lock check", async () => {
      // Create a settlement
      await signInWithEmailAndPassword(auth, bobEmail, bobPassword);
      const settlementId = "set-void-version-test";
      const createPayload = {
        clientOperationId: "op-void-version-create",
        groupId,
        settlementId,
        payerId: bobUid,
        receiverId: aliceUid,
        amountMinor: 500,
        currency: "USD",
        fxNumerator: 1,
        fxDenominator: 1,
      };
      await createSettlementFn(createPayload);

      // Call void with stale expectedVersion
      const voidPayload = {
        clientOperationId: "op-void-version-void",
        groupId,
        settlementId,
        expectedVersion: 0, // Stale version (should be 1)
        voidReason: "Stale void",
      };

      try {
        await voidSettlementFn(voidPayload);
        expect.fail("Should have failed with aborted");
      } catch (err: any) {
        expect(err.code).toMatch(/aborted/);
      }
    });
  });
}, 30000);

// ===================================================================
// Receipt Cloud Functions Integration Tests
// ===================================================================
describe("Receipt Cloud Functions Integration Tests", () => {
  const aliceEmail2 = "alice.receipt@example.com";
  const alicePassword2 = "password123";
  let aliceReceiptUid = "";

  const createReceiptFn = async (data: any) => {
    const handler = (await import("../../api/receipts/create.js")).default;
    const token = await auth.currentUser?.getIdToken();
    const res = await executeVercelHandler(handler, {
      headers: { authorization: `Bearer ${token}` },
      body: data
    });
    return { data: res };
  };

  const processReceiptOCRFn = async (data: any) => {
    const handler = (await import("../../api/receipts/process-ocr.js")).default;
    const token = await auth.currentUser?.getIdToken();
    const res = await executeVercelHandler(handler, {
      headers: { authorization: `Bearer ${token}` },
      body: data
    });
    return { data: res };
  };

  const receiptGroupId = "group-receipt-test";

  beforeAll(async () => {
    // Create alice for receipt tests
    await signOut(auth);
    try {
      const cred = await createUserWithEmailAndPassword(auth, aliceEmail2, alicePassword2);
      aliceReceiptUid = cred.user.uid;
    } catch {
      const cred = await signInWithEmailAndPassword(auth, aliceEmail2, alicePassword2);
      aliceReceiptUid = cred.user.uid;
    }

    // Use rules-disabled admin context to bootstrap group and membership
    const testEnvReceipt = await initializeTestEnvironment({
      projectId: "mock-project-id",
      firestore: { host: "127.0.0.1", port: 8080 },
    });

    await testEnvReceipt.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, `groups/${receiptGroupId}`), {
        id: receiptGroupId,
        name: "Receipt Test Group",
        baseCurrency: "USD",
        memberUserIds: [aliceReceiptUid],
        status: "active",
        createdBy: aliceReceiptUid,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await setDoc(doc(db, `groups/${receiptGroupId}/members/${aliceReceiptUid}`), {
        id: aliceReceiptUid,
        groupId: receiptGroupId,
        userId: aliceReceiptUid,
        displayName: "Alice",
        role: "owner",
        status: "active",
        joinedAt: new Date(),
      });
    });

    await testEnvReceipt.cleanup();
    // Sign in as alice
    await signInWithEmailAndPassword(auth, aliceEmail2, alicePassword2);
  });

  afterAll(async () => {
    await signOut(auth);
  });

  describe("createReceipt", () => {
    test("rejects call with missing required fields", async () => {
      try {
        await createReceiptFn({
          clientOperationId: "op-1",
          groupId: receiptGroupId,
          // Missing: receiptId, fileName, fileType, storagePath
        });
        expect.fail("Should have thrown invalid-argument");
      } catch (err: any) {
        expect(err.code).toMatch(/invalid-argument/);
      }
    });

    test("rejects unauthenticated call", async () => {
      await signOut(auth);
      try {
        await createReceiptFn({
          clientOperationId: "op-unauth",
          groupId: receiptGroupId,
          receiptId: "r-unauth",
          fileName: "test.jpg",
          fileType: "image/jpeg",
          storagePath: `groups/${receiptGroupId}/receipts/r-unauth/v1/test.jpg`,
        });
        expect.fail("Should have thrown unauthenticated");
      } catch (err: any) {
        expect(err.code).toMatch(/unauthenticated/);
      }
      // Re-sign in for subsequent tests
      await signInWithEmailAndPassword(auth, aliceEmail2, alicePassword2);
    });

    test("rejects call with invalid storage path structure", async () => {
      // The file won't exist in storage, so this should fail with not-found
      // (file metadata lookup fails)
      try {
        await createReceiptFn({
          clientOperationId: "op-badpath",
          groupId: receiptGroupId,
          receiptId: "r-badpath",
          fileName: "test.jpg",
          fileType: "image/jpeg",
          storagePath: `groups/${receiptGroupId}/receipts/r-badpath/v1/test.jpg`,
        });
        expect.fail("Should have thrown");
      } catch (err: any) {
        // Will fail at storage metadata check (file doesn't exist)
        expect(err.code).toMatch(/not-found|invalid-argument/);
      }
    });
  });

  describe("processReceiptOCR", () => {
    test("rejects unauthenticated call", async () => {
      await signOut(auth);
      try {
        await processReceiptOCRFn({
          groupId: receiptGroupId,
          storagePath: `groups/${receiptGroupId}/receipts/r-ocr/v1/test.jpg`,
        });
        expect.fail("Should have thrown unauthenticated");
      } catch (err: any) {
        expect(err.code).toMatch(/unauthenticated/);
      }
      await signInWithEmailAndPassword(auth, aliceEmail2, alicePassword2);
    });

    test("rejects call with missing storagePath", async () => {
      try {
        await processReceiptOCRFn({
          groupId: receiptGroupId,
          // missing storagePath
        });
        expect.fail("Should have thrown invalid-argument");
      } catch (err: any) {
        expect(err.code).toMatch(/invalid-argument/);
      }
    });

    test("returns mock OCR extraction result for valid call", async () => {
      const result = await processReceiptOCRFn({
        groupId: receiptGroupId,
        storagePath: `groups/${receiptGroupId}/receipts/r-ocr/v1/receipt.jpg`,
      });

      // The mock provider should return a valid extraction result
      const data = result.data;
      expect(data).toBeDefined();
      expect(data.merchant).toBeTruthy();
      expect(typeof data.subtotal).toBe("number");
      expect(typeof data.tax).toBe("number");
      expect(typeof data.total).toBe("number");
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.items.length).toBeGreaterThan(0);

      // Verify math: subtotal + tax + tip - discount == total
      expect(data.subtotal + data.tax + data.tip - data.discount).toBe(data.total);
    });
  });

  describe("Recurring Expenses & Scheduling", () => {
    const createRecurringTemplateFn = async (data: any) => {
      const handler = (await import("../../api/recurring/create-template.js")).default;
      const token = await auth.currentUser?.getIdToken();
      const res = await executeVercelHandler(handler, {
        headers: { authorization: `Bearer ${token}` },
        body: data
      });
      return { data: res };
    };

    const generateRecurringDraftsFn = async (data: any) => {
      const handler = (await import("../../api/recurring/generate-drafts.js")).default;
      const token = await auth.currentUser?.getIdToken();
      const res = await executeVercelHandler(handler, {
        headers: { authorization: `Bearer ${token}` },
        body: data
      });
      return { data: res };
    };

    const approveRecurringDraftFn = async (data: any) => {
      const handler = (await import("../../api/recurring/approve-draft.js")).default;
      const token = await auth.currentUser?.getIdToken();
      const res = await executeVercelHandler(handler, {
        headers: { authorization: `Bearer ${token}` },
        body: data
      });
      return { data: res };
    };

    const skipRecurringOccurrenceFn = async (data: any) => {
      const handler = (await import("../../api/recurring/skip-occurrence.js")).default;
      const token = await auth.currentUser?.getIdToken();
      const res = await executeVercelHandler(handler, {
        headers: { authorization: `Bearer ${token}` },
        body: data
      });
      return { data: res };
    };

    const recGroupId = "rec-group-123";
    const tempId = "rec-temp-123";
    let testEnvRec: any;

    const recAliceEmail = "alice.rec@example.com";
    const recAlicePassword = "password123";
    let recAliceUid = "";

    const recBobEmail = "rec.bob@example.com";
    const recBobPassword = "password123";
    let recBobUid = "";

    const recCharlieEmail = "rec.charlie@example.com";
    const recCharliePassword = "password123";
    let recCharlieUid = "";

    beforeAll(async () => {
      const admin: any = await import("firebase-admin");
      if (admin.apps.length === 0) {
        admin.initializeApp({
          projectId: "mock-project-id",
        });
      }

      testEnvRec = await initializeTestEnvironment({
        projectId: "mock-project-id",
        firestore: {
          host: "127.0.0.1",
          port: 8080,
        },
      });

      // Register / Fetch test users
      await signOut(auth);
      try {
        const cred = await createUserWithEmailAndPassword(auth, recAliceEmail, recAlicePassword);
        recAliceUid = cred.user.uid;
      } catch {
        const cred = await signInWithEmailAndPassword(auth, recAliceEmail, recAlicePassword);
        recAliceUid = cred.user.uid;
      }

      try {
        const cred = await createUserWithEmailAndPassword(auth, recBobEmail, recBobPassword);
        recBobUid = cred.user.uid;
      } catch {
        const cred = await signInWithEmailAndPassword(auth, recBobEmail, recBobPassword);
        recBobUid = cred.user.uid;
      }

      try {
        const cred = await createUserWithEmailAndPassword(auth, recCharlieEmail, recCharliePassword);
        recCharlieUid = cred.user.uid;
      } catch {
        const cred = await signInWithEmailAndPassword(auth, recCharlieEmail, recCharliePassword);
        recCharlieUid = cred.user.uid;
      }
    });

    afterAll(async () => {
      await testEnvRec?.cleanup();
    });

    beforeEach(async () => {
      await testEnvRec.clearFirestore();

      // Bootstrap recurring group and members using rules-disabled context
      await testEnvRec.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        await setDoc(doc(db, `groups/${recGroupId}`), {
          id: recGroupId,
          name: "Recurring Group",
          nameLower: "recurring group",
          baseCurrency: "USD",
          ownerUserId: recAliceUid,
          memberUserIds: [recAliceUid, recBobUid],
          activeMemberCount: 2,
          status: "active",
          createdAt: new Date(),
          createdBy: recAliceUid,
          updatedAt: new Date(),
          updatedBy: recAliceUid,
          version: 1,
          schemaVersion: 1,
        });

        await setDoc(doc(db, `groups/${recGroupId}/members/${recAliceUid}`), {
          id: recAliceUid,
          groupId: recGroupId,
          kind: "account",
          userId: recAliceUid,
          displayName: "Alice",
          displayNameLower: "alice",
          role: "owner",
          status: "active",
        });

        await setDoc(doc(db, `groups/${recGroupId}/members/${recBobUid}`), {
          id: recBobUid,
          groupId: recGroupId,
          kind: "account",
          userId: recBobUid,
          displayName: "Bob",
          displayNameLower: "bob",
          role: "member",
          status: "active",
        });

        await setDoc(doc(db, `groups/${recGroupId}/members/${recCharlieUid}`), {
          id: recCharlieUid,
          groupId: recGroupId,
          kind: "account",
          userId: recCharlieUid,
          displayName: "Charlie",
          displayNameLower: "charlie",
          role: "viewer",
          status: "active",
        });
      });
    });

    test("createRecurringTemplate succeeds and computes start local date", async () => {
      await signInWithEmailAndPassword(auth, recAliceEmail, recAlicePassword);

      const res = await createRecurringTemplateFn({
        clientOperationId: "op-create-temp-1",
        groupId: recGroupId,
        templateId: tempId,
        title: "Rent Payment",
        category: "housing",
        amountMinor: 100000, // $1000
        currency: "USD",
        fxNumerator: 1,
        fxDenominator: 1,
        splitMethod: "equal",
        payers: [{ memberId: recAliceUid, amountMinor: 100000 }],
        splits: [
          { memberId: recAliceUid, amountMinor: 50000 },
          { memberId: recBobUid, amountMinor: 50000 },
        ],
        schedule: {
          frequency: "monthly",
          interval: 1,
          startLocalDate: "2026-01-31",
        },
        timeZone: "Asia/Kolkata",
      });

      expect(res.data.templateId).toBe(tempId);

      // Verify template doc is stored properly
      await testEnvRec.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        const snap = await getDoc(doc(db, `groups/${recGroupId}/recurringTemplates/${tempId}`));
        expect(snap.exists()).toBe(true);
        const data = snap.data()!;
        expect(data.status).toBe("active");
        expect(data.nextOccurrenceDate).toBe("2026-01-31");
      });
    });

    test("generateRecurringDrafts produces deterministic occurrences and catchup", async () => {
      await signInWithEmailAndPassword(auth, recAliceEmail, recAlicePassword);

      // 1. Create template started in the past (Jan 31, 2026)
      await createRecurringTemplateFn({
        clientOperationId: "op-create-temp-catchup",
        groupId: recGroupId,
        templateId: tempId,
        title: "Monthly Rent",
        category: "housing",
        amountMinor: 100000,
        currency: "USD",
        fxNumerator: 1,
        fxDenominator: 1,
        splitMethod: "equal",
        payers: [{ memberId: recAliceUid, amountMinor: 100000 }],
        splits: [
          { memberId: recAliceUid, amountMinor: 50000 },
          { memberId: recBobUid, amountMinor: 50000 },
        ],
        schedule: {
          frequency: "monthly",
          interval: 1,
          startLocalDate: "2026-01-31",
        },
        timeZone: "Asia/Kolkata",
      });

      // 2. Mock execute generate drafts with "now" set to March 15, 2026
      // Jan 31 -> should generate Jan 31 and Feb 28 drafts. Next occurrence should advance to Mar 31.
      const march15Timestamp = Date.UTC(2026, 2, 15, 12, 0, 0);

      // Trigger via backend runner helper with customized timestamp
      const recurringOpsModule = await import("../../functions/src/recurringOperations.js" as any);
      await recurringOpsModule.executeGenerateDraftsForGroup(recGroupId, march15Timestamp);

      // 3. Verify deterministic occurrence docs exist
      await testEnvRec.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        const snap1 = await getDoc(doc(db, `groups/${recGroupId}/recurringTemplates/${tempId}/occurrences/2026-01-31`));
        const snap2 = await getDoc(doc(db, `groups/${recGroupId}/recurringTemplates/${tempId}/occurrences/2026-02-28`));
        const snap3 = await getDoc(doc(db, `groups/${recGroupId}/recurringTemplates/${tempId}/occurrences/2026-03-31`));

        expect(snap1.exists()).toBe(true);
        expect(snap2.exists()).toBe(true);
        expect(snap3.exists()).toBe(false); // March 31 has not happened yet on March 15

        expect(snap1.data()?.status).toBe("pending");

        // Check next occurrence progressed
        const tSnap = await getDoc(doc(db, `groups/${recGroupId}/recurringTemplates/${tempId}`));
        expect(tSnap.data()?.nextOccurrenceDate).toBe("2026-03-31");
      });
    });

    test("removed member flags validationError for non-equal splits, auto-recalculates equal splits", async () => {
      await signInWithEmailAndPassword(auth, recAliceEmail, recAlicePassword);

      // 1. Create monthly equal split template
      const equalTempId = "rec-temp-equal";
      await createRecurringTemplateFn({
        clientOperationId: "op-create-temp-eq",
        groupId: recGroupId,
        templateId: equalTempId,
        title: "Rent Equal",
        category: "housing",
        amountMinor: 100000,
        currency: "USD",
        fxNumerator: 1,
        fxDenominator: 1,
        splitMethod: "equal",
        payers: [{ memberId: recAliceUid, amountMinor: 100000 }],
        splits: [
          { memberId: recAliceUid, amountMinor: 50000 },
          { memberId: recBobUid, amountMinor: 50000 },
        ],
        schedule: {
          frequency: "monthly",
          interval: 1,
          startLocalDate: "2026-01-31",
        },
        timeZone: "Asia/Kolkata",
      });

      // 2. Create exact split template
      const exactTempId = "rec-temp-exact";
      await createRecurringTemplateFn({
        clientOperationId: "op-create-temp-ex",
        groupId: recGroupId,
        templateId: exactTempId,
        title: "Rent Exact",
        category: "housing",
        amountMinor: 100000,
        currency: "USD",
        fxNumerator: 1,
        fxDenominator: 1,
        splitMethod: "exact",
        payers: [{ memberId: recAliceUid, amountMinor: 100000 }],
        splits: [
          { memberId: recAliceUid, amountMinor: 40000 },
          { memberId: recBobUid, amountMinor: 60000 },
        ],
        schedule: {
          frequency: "monthly",
          interval: 1,
          startLocalDate: "2026-01-31",
        },
        timeZone: "Asia/Kolkata",
      });

      // 3. Remove Bob AFTER templates are created
      await testEnvRec.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        await setDoc(doc(db, `groups/${recGroupId}/members/${recBobUid}`), {
          id: recBobUid,
          groupId: recGroupId,
          userId: recBobUid,
          status: "removed",
        });
      });

      // 4. Trigger generation
      await generateRecurringDraftsFn({ groupId: recGroupId });

      // Equal split template occurrence should automatically recalculate splits (Bob removed, Alice gets 100%)
      await testEnvRec.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        const occEq = await getDoc(
          doc(db, `groups/${recGroupId}/recurringTemplates/${equalTempId}/occurrences/2026-01-31`)
        );
        expect(occEq.exists()).toBe(true);
        expect(occEq.data()?.validationError).toBeNull();
        expect(occEq.data()?.recalculatedSplits).toHaveLength(1);
        expect(occEq.data()?.recalculatedSplits[0].memberId).toBe(recAliceUid);
        expect(occEq.data()?.recalculatedSplits[0].amountMinor).toBe(100000);

        // Exact split template occurrence should have a validationError
        const occEx = await getDoc(
          doc(db, `groups/${recGroupId}/recurringTemplates/${exactTempId}/occurrences/2026-01-31`)
        );
        expect(occEx.exists()).toBe(true);
        expect(occEx.data()?.validationError).toContain(recBobUid);
      });
    });

    test("approveRecurringDraft creates ledger expense and marks occurrence approved", async () => {
      await signInWithEmailAndPassword(auth, recAliceEmail, recAlicePassword);

      // Create template
      await createRecurringTemplateFn({
        clientOperationId: "op-create-appr-temp",
        groupId: recGroupId,
        templateId: tempId,
        title: "Broadband Internet",
        category: "utilities",
        amountMinor: 2000,
        currency: "USD",
        fxNumerator: 1,
        fxDenominator: 1,
        splitMethod: "equal",
        payers: [{ memberId: recAliceUid, amountMinor: 2000 }],
        splits: [
          { memberId: recAliceUid, amountMinor: 1000 },
          { memberId: recBobUid, amountMinor: 1000 },
        ],
        schedule: {
          frequency: "monthly",
          interval: 1,
          startLocalDate: "2026-01-31",
        },
        timeZone: "Asia/Kolkata",
      });

      // Generate drafts
      await generateRecurringDraftsFn({ groupId: recGroupId });

      // Approve occurrence
      const expenseId = "exp-posted-123";
      const res = await approveRecurringDraftFn({
        clientOperationId: "op-approve-draft-1",
        groupId: recGroupId,
        templateId: tempId,
        occurrenceDate: "2026-01-31",
        expenseId,
      });

      expect(res.data.expenseId).toBe(expenseId);

      await testEnvRec.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        // Check expense was created
        const expSnap = await getDoc(doc(db, `groups/${recGroupId}/expenses/${expenseId}`));
        expect(expSnap.exists()).toBe(true);
        expect(expSnap.data()?.title).toBe("Broadband Internet (2026-01-31)");

        // Check occurrence updated
        const occSnap = await getDoc(
          doc(db, `groups/${recGroupId}/recurringTemplates/${tempId}/occurrences/2026-01-31`)
        );
        expect(occSnap.data()?.status).toBe("approved");
      });
    });

    test("skipRecurringOccurrence skips draft", async () => {
      await signInWithEmailAndPassword(auth, recAliceEmail, recAlicePassword);

      await createRecurringTemplateFn({
        clientOperationId: "op-create-skip-temp",
        groupId: recGroupId,
        templateId: tempId,
        title: "Weekly Magazine",
        category: "other",
        amountMinor: 500,
        currency: "USD",
        fxNumerator: 1,
        fxDenominator: 1,
        splitMethod: "equal",
        payers: [{ memberId: recAliceUid, amountMinor: 500 }],
        splits: [{ memberId: recAliceUid, amountMinor: 500 }],
        schedule: {
          frequency: "weekly",
          interval: 1,
          startLocalDate: "2026-03-01",
        },
        timeZone: "Asia/Kolkata",
      });

      await generateRecurringDraftsFn({ groupId: recGroupId });

      await skipRecurringOccurrenceFn({
        clientOperationId: "op-skip-occ-1",
        groupId: recGroupId,
        templateId: tempId,
        occurrenceDate: "2026-03-01",
      });

      await testEnvRec.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        const occSnap = await getDoc(
          doc(db, `groups/${recGroupId}/recurringTemplates/${tempId}/occurrences/2026-03-01`)
        );
        expect(occSnap.data()?.status).toBe("skipped");
      });
    });
  }, 30000);

  describe("Budget Operations", () => {
    const bgtGroupId = "group-budget-test";
    const createBudgetFn = async (data: any) => {
      const handler = (await import("../../api/budgets/create.js")).default;
      const token = await auth.currentUser?.getIdToken();
      const res = await executeVercelHandler(handler, {
        headers: { authorization: `Bearer ${token}` },
        body: data
      });
      return { data: res };
    };

    const updateBudgetFn = async (data: any) => {
      const handler = (await import("../../api/budgets/update.js")).default;
      const token = await auth.currentUser?.getIdToken();
      const res = await executeVercelHandler(handler, {
        headers: { authorization: `Bearer ${token}` },
        body: data
      });
      return { data: res };
    };

    const deleteBudgetFn = async (data: any) => {
      const handler = (await import("../../api/budgets/delete.js")).default;
      const token = await auth.currentUser?.getIdToken();
      const res = await executeVercelHandler(handler, {
        headers: { authorization: `Bearer ${token}` },
        body: data
      });
      return { data: res };
    };

    let bgtAliceUid = "";
    let bgtBobUid = "";
    let testEnvBgt: RulesTestEnvironment;

    beforeAll(async () => {
      testEnvBgt = await initializeTestEnvironment({
        projectId: "mock-project-id",
        firestore: {
          host: "127.0.0.1",
          port: 8080,
        },
      });

      await signOut(auth);

      // Create Alice (Owner)
      try {
        const cred = await createUserWithEmailAndPassword(auth, "alice.bgt@example.com", "password123");
        bgtAliceUid = cred.user.uid;
      } catch {
        const cred = await signInWithEmailAndPassword(auth, "alice.bgt@example.com", "password123");
        bgtAliceUid = cred.user.uid;
      }

      // Create Bob (Member)
      try {
        const cred = await createUserWithEmailAndPassword(auth, "bob.bgt@example.com", "password123");
        bgtBobUid = cred.user.uid;
      } catch {
        const cred = await signInWithEmailAndPassword(auth, "bob.bgt@example.com", "password123");
        bgtBobUid = cred.user.uid;
      }

      // Setup Group and Members
      await testEnvBgt.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, `groups/${bgtGroupId}`), {
          id: bgtGroupId,
          name: "Budget Testing Group",
          nameLower: "budget testing group",
          baseCurrency: "USD",
          ownerUserId: bgtAliceUid,
          memberUserIds: [bgtAliceUid, bgtBobUid],
          activeMemberCount: 2,
          status: "active",
          createdAt: new Date(),
          createdBy: bgtAliceUid,
          updatedAt: new Date(),
          updatedBy: bgtAliceUid,
          version: 1,
          schemaVersion: 1,
        });

        await setDoc(doc(db, `groups/${bgtGroupId}/members/${bgtAliceUid}`), {
          id: bgtAliceUid,
          groupId: bgtGroupId,
          userId: bgtAliceUid,
          role: "owner",
          status: "active",
          createdAt: new Date(),
          createdBy: bgtAliceUid,
          updatedAt: new Date(),
          updatedBy: bgtAliceUid,
          version: 1,
          schemaVersion: 1,
        });

        await setDoc(doc(db, `groups/${bgtGroupId}/members/${bgtBobUid}`), {
          id: bgtBobUid,
          groupId: bgtGroupId,
          userId: bgtBobUid,
          role: "member",
          status: "active",
          createdAt: new Date(),
          createdBy: bgtAliceUid,
          updatedAt: new Date(),
          updatedBy: bgtAliceUid,
          version: 1,
          schemaVersion: 1,
        });
      });
    });

    test("createBudget creates a budget document and revision", async () => {
      await signInWithEmailAndPassword(auth, "alice.bgt@example.com", "password123");

      const budgetId = "bgt-overall-1";
      const res = await createBudgetFn({
        clientOperationId: "op-create-bgt-1",
        groupId: bgtGroupId,
        budgetId,
        name: "Monthly Allowance",
        scope: "overall",
        period: "monthly",
        timeZone: "UTC",
        startDate: "2026-03-01",
        amountMinor: 10000,
        currency: "USD",
      });

      expect(res.data.budgetId).toBe(budgetId);
      expect(res.data.version).toBe(1);

      await testEnvBgt.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        const bSnap = await getDoc(doc(db, `groups/${bgtGroupId}/budgets/${budgetId}`));
        expect(bSnap.exists()).toBe(true);
        expect(bSnap.data()?.name).toBe("Monthly Allowance");
        expect(bSnap.data()?.status).toBe("active");

        const rSnap = await getDoc(doc(db, `groups/${bgtGroupId}/budgets/${budgetId}/revisions/1`));
        expect(rSnap.exists()).toBe(true);
      });
    });

    test("createBudget enforces personal member constraint server-side", async () => {
      await signInWithEmailAndPassword(auth, "bob.bgt@example.com", "password123");

      // Bob tries to create an overall budget (should fail because he is not owner/admin)
      await expect(
        createBudgetFn({
          clientOperationId: "op-create-bgt-fail",
          groupId: bgtGroupId,
          budgetId: "bgt-fail",
          name: "Bob's Overall Cap",
          scope: "overall",
          period: "monthly",
          timeZone: "UTC",
          startDate: "2026-03-01",
          amountMinor: 5000,
          currency: "USD",
        })
      ).rejects.toThrow();

      // Bob creates a personal budget for himself (should succeed)
      const res = await createBudgetFn({
        clientOperationId: "op-create-bgt-bob-ok",
        groupId: bgtGroupId,
        budgetId: "bgt-bob-personal",
        name: "Bob's Cap",
        scope: "member",
        memberId: bgtBobUid, // matches Bob's memberId
        period: "monthly",
        timeZone: "UTC",
        startDate: "2026-03-01",
        amountMinor: 3000,
        currency: "USD",
      });
      expect(res.data.budgetId).toBe("bgt-bob-personal");
    });

    test("updateBudget modifies document and increments version with conflict detection", async () => {
      await signInWithEmailAndPassword(auth, "alice.bgt@example.com", "password123");

      const budgetId = "bgt-overall-1";

      // Attempt update with wrong version (conflict check)
      await expect(
        updateBudgetFn({
          clientOperationId: "op-update-bgt-conflict",
          groupId: bgtGroupId,
          budgetId,
          expectedVersion: 99, // incorrect
          name: "Conflicted Budget Update",
          scope: "overall",
          period: "monthly",
          timeZone: "UTC",
          startDate: "2026-03-01",
          amountMinor: 20000,
          currency: "USD",
          status: "active",
        })
      ).rejects.toThrow();

      // Correct version update
      const res = await updateBudgetFn({
        clientOperationId: "op-update-bgt-ok",
        groupId: bgtGroupId,
        budgetId,
        expectedVersion: 1,
        name: "Monthly Group Allowance",
        scope: "overall",
        period: "monthly",
        timeZone: "UTC",
        startDate: "2026-03-01",
        amountMinor: 20000,
        currency: "USD",
        status: "paused", // toggling status to paused
      });

      expect(res.data.version).toBe(2);

      await testEnvBgt.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        const bSnap = await getDoc(doc(db, `groups/${bgtGroupId}/budgets/${budgetId}`));
        expect(bSnap.data()?.name).toBe("Monthly Group Allowance");
        expect(bSnap.data()?.status).toBe("paused");
        expect(bSnap.data()?.version).toBe(2);

        const rSnap = await getDoc(doc(db, `groups/${bgtGroupId}/budgets/${budgetId}/revisions/2`));
        expect(rSnap.exists()).toBe(true);
      });
    });

    test("deleteBudget soft-deletes the budget and blocks further edits", async () => {
      await signInWithEmailAndPassword(auth, "alice.bgt@example.com", "password123");

      const budgetId = "bgt-overall-1";

      const res = await deleteBudgetFn({
        clientOperationId: "op-delete-bgt-ok",
        groupId: bgtGroupId,
        budgetId,
        expectedVersion: 2,
      });

      expect(res.data.version).toBe(3);

      await testEnvBgt.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        const bSnap = await getDoc(doc(db, `groups/${bgtGroupId}/budgets/${budgetId}`));
        expect(bSnap.data()?.status).toBe("deleted");

        // Attempting to update a deleted budget must be rejected
        await expect(
          updateBudgetFn({
            clientOperationId: "op-update-deleted-fail",
            groupId: bgtGroupId,
            budgetId,
            expectedVersion: 3,
            name: "Try Editing Deleted",
            scope: "overall",
            period: "monthly",
            timeZone: "UTC",
            startDate: "2026-03-01",
            amountMinor: 1000,
            currency: "USD",
            status: "active",
          })
        ).rejects.toThrow();
      });
    });
  });
});

// ===================================================================
// Group & Account Deletion Integration Tests (Phase 10)
// ===================================================================
describe("Group & Account Deletion Integration Tests", () => {
  let testEnvDel: RulesTestEnvironment;
  const aliceDEmail = "alice.del@example.com";
  const aliceDPass = "password123";
  let aliceDUid = "";

  const bobDEmail = "bob.del@example.com";
  const bobDPass = "password123";
  let bobDUid = "";

  const delGroupFn = async (data: any) => {
    const handler = (await import("../../api/groups/delete.js")).default;
    const token = await auth.currentUser?.getIdToken();
    const res = await executeVercelHandler(handler, {
      headers: { authorization: `Bearer ${token}` },
      body: data
    });
    return { data: res };
  };

  const delAccountFn = async (data: any) => {
    const handler = (await import("../../api/accounts/delete.js")).default;
    const token = await auth.currentUser?.getIdToken();
    const res = await executeVercelHandler(handler, {
      headers: { authorization: `Bearer ${token}` },
      body: data
    });
    return { data: res };
  };

  beforeAll(async () => {
    testEnvDel = await initializeTestEnvironment({
      projectId: "mock-project-id",
      firestore: { host: "127.0.0.1", port: 8080 },
    });

    // Create users
    const aliceCred = await createUserWithEmailAndPassword(auth, aliceDEmail, aliceDPass);
    aliceDUid = aliceCred.user.uid;
    const bobCred = await createUserWithEmailAndPassword(auth, bobDEmail, bobDPass);
    bobDUid = bobCred.user.uid;

    // Set up user profiles
    await testEnvDel.withSecurityRulesDisabled(async (context: any) => {
      const db = context.firestore();
      await setDoc(doc(db, "users", aliceDUid), {
        uid: aliceDUid,
        displayName: "Alice Del",
        email: aliceDEmail,
        accountStatus: "active",
        version: 1,
        schemaVersion: 1,
      });
      await setDoc(doc(db, "users", bobDUid), {
        uid: bobDUid,
        displayName: "Bob Del",
        email: bobDEmail,
        accountStatus: "active",
        version: 1,
        schemaVersion: 1,
      });
    });
  }, 30000);

  afterAll(async () => {
    await signOut(auth);
    await testEnvDel?.cleanup();
  });

  test("deleteGroup fails for non-owners and succeeds for owner with paged index cleanup", async () => {
    const targetGroupId = "grp-del-test";
    await testEnvDel.withSecurityRulesDisabled(async (context: any) => {
      const db = context.firestore();
      await setDoc(doc(db, "groups", targetGroupId), {
        id: targetGroupId,
        name: "Delete Test Group",
        ownerUserId: aliceDUid,
        memberUserIds: [aliceDUid, bobDUid],
        activeMemberCount: 2,
        status: "active",
        version: 1,
      });
      await setDoc(doc(db, `groups/${targetGroupId}/members/${aliceDUid}`), {
        id: aliceDUid, userId: aliceDUid, groupId: targetGroupId,
        role: "owner", status: "active", kind: "account",
      });
      await setDoc(doc(db, `groups/${targetGroupId}/members/${bobDUid}`), {
        id: bobDUid, userId: bobDUid, groupId: targetGroupId,
        role: "member", status: "active", kind: "account",
      });
      await setDoc(doc(db, `userGroupIndex/${aliceDUid}/groups/${targetGroupId}`), {
        groupId: targetGroupId, groupName: "Delete Test Group", role: "owner", status: "active",
      });
      await setDoc(doc(db, `userGroupIndex/${bobDUid}/groups/${targetGroupId}`), {
        groupId: targetGroupId, groupName: "Delete Test Group", role: "member", status: "active",
      });
    });

    // 1. Bob attempts to delete group -> fails (not owner)
    await signInWithEmailAndPassword(auth, bobDEmail, bobDPass);
    await expect(delGroupFn({ groupId: targetGroupId })).rejects.toThrow();

    // 2. Alice deletes group -> succeeds
    await signInWithEmailAndPassword(auth, aliceDEmail, aliceDPass);
    const res = await delGroupFn({ groupId: targetGroupId });
    expect(res.data.status).toBe("completed");

    // Verify DB state
    await testEnvDel.withSecurityRulesDisabled(async (context: any) => {
      const db = context.firestore();
      const gSnap = await getDoc(doc(db, "groups", targetGroupId));
      expect(gSnap.data()?.status).toBe("deleted");
      expect(gSnap.data()?.deletionCleanupStatus?.status).toBe("completed");

      const bobIndexSnap = await getDoc(doc(db, `userGroupIndex/${bobDUid}/groups/${targetGroupId}`));
      expect(bobIndexSnap.data()?.status).toBe("deleted");

      // Verify exactly one group_deleted activity event created
      const actSnap = await getDocs(collection(db, `groups/${targetGroupId}/activities`));
      const deletedActs = actSnap.docs.filter((d) => d.data().type === "group_deleted");
      expect(deletedActs.length).toBe(1);
    });

    // 3. Repeated call is idempotent
    const resRepeat = await delGroupFn({ groupId: targetGroupId });
    expect(resRepeat.data.status).toBe("completed");
  }, 30000);

  test("deleteAccount blocks if user owns active groups and succeeds if not", async () => {
    // Alice owns grp-del-test -> must fail
    await signInWithEmailAndPassword(auth, aliceDEmail, aliceDPass);
    // Note: grp-del-test status is now "deleted" from previous test so Alice might pass
    // if the function only checks active/archived ownership.
    // Let's create a new active group for Alice to truly test ownership blocking:
    const activeGroupId = "grp-active-own";
    await testEnvDel.withSecurityRulesDisabled(async (context: any) => {
      const db = context.firestore();
      await setDoc(doc(db, "groups", activeGroupId), {
        id: activeGroupId, name: "Active Group", ownerUserId: aliceDUid,
        memberUserIds: [aliceDUid], activeMemberCount: 1,
        status: "active", version: 1,
      });
      await setDoc(doc(db, `userGroupIndex/${aliceDUid}/groups/${activeGroupId}`), {
        groupId: activeGroupId, groupName: "Active Group", role: "owner", status: "active",
      });
    });
    await expect(delAccountFn({})).rejects.toThrow();

    // Create a temp user who doesn't own any groups
    const tempEmail = "temp.del@example.com";
    const tempPass = "password123";
    const userCred = await createUserWithEmailAndPassword(auth, tempEmail, tempPass);
    const tempUid = userCred.user.uid;

    await testEnvDel.withSecurityRulesDisabled(async (context: any) => {
      const db = context.firestore();
      await setDoc(doc(db, "users", tempUid), {
        uid: tempUid, displayName: "Temp Delete", email: tempEmail,
        accountStatus: "active", version: 1, schemaVersion: 1,
      });
      // Add temp as a member of grp-del-test
      await setDoc(doc(db, `groups/grp-del-test/members/${tempUid}`), {
        id: tempUid, userId: tempUid, groupId: "grp-del-test",
        role: "member", status: "active", kind: "account",
      });
      await setDoc(doc(db, `userGroupIndex/${tempUid}/groups/grp-del-test`), {
        groupId: "grp-del-test", groupName: "Delete Test Group", role: "member", status: "active",
      });
    });

    // Temp user deletes account -> succeeds
    await signInWithEmailAndPassword(auth, tempEmail, tempPass);
    const res = await delAccountFn({});
    expect(res.data.success).toBe(true);

    // Verify cleanup
    await testEnvDel.withSecurityRulesDisabled(async (context: any) => {
      const db = context.firestore();
      const memberSnap = await getDoc(doc(db, "groups/grp-del-test/members", tempUid));
      expect(memberSnap.data()?.status).toBe("left");

      const indexSnap = await getDoc(doc(db, `userGroupIndex/${tempUid}/groups/grp-del-test`));
      expect(indexSnap.data()?.status).toBe("left");

      const profileSnap = await getDoc(doc(db, "users", tempUid));
      expect(profileSnap.data()?.accountStatus).toBe("deleted");
      expect(profileSnap.data()?.displayName).toBe("Deleted User");
    });
  }, 30000);
});

