/* eslint-disable @typescript-eslint/no-explicit-any */
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as crypto from "crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type {
  ExpenseCategory,
  SplitMethod,
  ExpensePayer,
  ExpenseSplit,
  ExpenseDocument,
  ExpenseOperationReceipt,
} from "@fairtab/domain";
import {
  splitEqual,
  splitPercentage,
  splitShares,
} from "@fairtab/domain";

// Helper to canonicalize object payloads for consistent hashing
export function canonicalizePayload(val: any): any {
  if (val === null || val === undefined) return val;
  if (Array.isArray(val)) {
    const normalizedArray = val.map(canonicalizePayload);
    if (
      normalizedArray.length > 0 &&
      normalizedArray[0] &&
      typeof normalizedArray[0] === "object" &&
      "memberId" in normalizedArray[0]
    ) {
      normalizedArray.sort((a: any, b: any) => a.memberId.localeCompare(b.memberId));
    } else if (normalizedArray.length > 0 && typeof normalizedArray[0] === "string") {
      normalizedArray.sort();
    }
    return normalizedArray;
  }
  if (typeof val === "object") {
    const sortedObj: any = {};
    Object.keys(val)
      .sort()
      .forEach((key) => {
        sortedObj[key] = canonicalizePayload(val[key]);
      });
    return sortedObj;
  }
  return val;
}

export function computePayloadHash(payload: any): string {
  const canonical = canonicalizePayload(payload);
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonical))
    .digest("hex");
}

interface CreateExpenseInput {
  clientOperationId: string;
  groupId: string;
  expenseId: string;
  title: string;
  notes?: string;
  category: ExpenseCategory;
  incurredAtSeconds: number;
  currency: string;
  amountMinor: number;
  fxNumerator: number;
  fxDenominator: number;
  splitMethod: SplitMethod;
  payers: Omit<ExpensePayer, "baseAmountMinor">[];
  splits: Omit<ExpenseSplit, "baseAmountMinor">[];
  receiptId?: string;
}

interface UpdateExpenseInput {
  clientOperationId: string;
  groupId: string;
  expenseId: string;
  expectedVersion: number;
  title: string;
  notes?: string;
  category: ExpenseCategory;
  incurredAtSeconds: number;
  currency: string;
  amountMinor: number;
  fxNumerator: number;
  fxDenominator: number;
  splitMethod: SplitMethod;
  payers: Omit<ExpensePayer, "baseAmountMinor">[];
  splits: Omit<ExpenseSplit, "baseAmountMinor">[];
  receiptId?: string;
}

interface VoidExpenseInput {
  clientOperationId: string;
  groupId: string;
  expenseId: string;
  expectedVersion: number;
  voidReason?: string;
}

// Validation logic for creation and update payloads
function validateFinancialPayload(
  amountMinor: number,
  currency: string,
  groupBaseCurrency: string,
  fxNumerator: number,
  fxDenominator: number,
  splitMethod: SplitMethod,
  payers: Omit<ExpensePayer, "baseAmountMinor">[],
  splits: Omit<ExpenseSplit, "baseAmountMinor">[],
  activeMemberIds: Set<string>
): {
  validatedPayers: ExpensePayer[];
  validatedSplits: ExpenseSplit[];
  baseAmountMinor: number;
} {
  // Amount must be positive and non-zero
  if (amountMinor <= 0 || !Number.isInteger(amountMinor) || amountMinor > Number.MAX_SAFE_INTEGER) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Expense amount must be a positive integer in minor units under MAX_SAFE_INTEGER."
    );
  }

  // FX validation
  if (currency === groupBaseCurrency) {
    if (fxNumerator !== 1 || fxDenominator !== 1) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "FX exchange rate must be 1:1 for matching currencies."
      );
    }
  } else {
    if (
      fxNumerator <= 0 ||
      fxDenominator <= 0 ||
      !Number.isInteger(fxNumerator) ||
      !Number.isInteger(fxDenominator)
    ) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "FX exchange rate must be positive integers."
      );
    }
  }

  const baseAmountMinor = Math.round((amountMinor * fxNumerator) / fxDenominator);
  if (baseAmountMinor < 0 || !Number.isFinite(baseAmountMinor) || baseAmountMinor > Number.MAX_SAFE_INTEGER) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Calculated base amount overflow or invalid value."
    );
  }

  // Validate active members and duplicate ids
  const payerMemberIds = new Set<string>();
  let totalPaidMinor = 0;
  for (const payer of payers) {
    if (!activeMemberIds.has(payer.memberId)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Payer ${payer.memberId} is not an active member of the group.`
      );
    }
    if (payer.amountMinor <= 0 || !Number.isInteger(payer.amountMinor)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Paid amount for member ${payer.memberId} must be a positive integer.`
      );
    }
    if (payerMemberIds.has(payer.memberId)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Payer ${payer.memberId} specified multiple times.`
      );
    }
    payerMemberIds.add(payer.memberId);
    totalPaidMinor += payer.amountMinor;
  }

  if (totalPaidMinor !== amountMinor) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Sum of payer amounts does not match the total expense amount."
    );
  }

  // Map validated payers
  const validatedPayers: ExpensePayer[] = payers.map((p) => ({
    memberId: p.memberId,
    amountMinor: p.amountMinor,
    baseAmountMinor: Math.round((p.amountMinor * fxNumerator) / fxDenominator),
  }));

  // Validate split members and calculations
  const splitMemberIds = new Set<string>();
  for (const split of splits) {
    if (!activeMemberIds.has(split.memberId)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Split participant ${split.memberId} is not an active member of the group.`
      );
    }
    if (splitMemberIds.has(split.memberId)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Split participant ${split.memberId} specified multiple times.`
      );
    }
    splitMemberIds.add(split.memberId);
  }

  if (splits.length === 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Expense must have at least one split participant."
    );
  }

  // Verify splits based on split method
  let expectedSplits: { memberId: string; amountMinor: number }[];
  const participants = Array.from(splitMemberIds).sort();

  if (splitMethod === "equal") {
    expectedSplits = splitEqual(amountMinor, participants);
  } else if (splitMethod === "exact") {
    // For exact splits, sum must match total amountMinor
    let exactSum = 0;
    for (const split of splits) {
      if (split.amountMinor <= 0 || !Number.isInteger(split.amountMinor)) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          `Exact split amount for member ${split.memberId} must be a positive integer.`
        );
      }
      exactSum += split.amountMinor;
    }
    if (exactSum !== amountMinor) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Sum of exact split amounts does not match total expense amount."
      );
    }
    expectedSplits = splits.map((s) => ({ memberId: s.memberId, amountMinor: s.amountMinor }));
  } else if (splitMethod === "percentage") {
    // Collect percentages (bps)
    const bpsMap: Record<string, number> = {};
    let totalBps = 0;
    for (const split of splits) {
      const bps = split.percentageBps;
      if (bps === undefined || bps <= 0 || !Number.isInteger(bps)) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          `Percentage split for ${split.memberId} requires positive integer basis points.`
        );
      }
      bpsMap[split.memberId] = bps;
      totalBps += bps;
    }
    if (totalBps !== 10000) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Total percentage basis points must sum to exactly 10000 (100%)."
      );
    }
    expectedSplits = splitPercentage(amountMinor, bpsMap, participants);
  } else if (splitMethod === "shares") {
    // Collect shares
    const sharesMap: Record<string, number> = {};
    for (const split of splits) {
      const shares = split.shares;
      if (shares === undefined || shares <= 0 || !Number.isInteger(shares)) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          `Shares split for ${split.memberId} requires positive integer shares.`
        );
      }
      sharesMap[split.memberId] = shares;
    }
    expectedSplits = splitShares(amountMinor, sharesMap, participants);
  } else {
    throw new functions.https.HttpsError("invalid-argument", "Unsupported split method.");
  }

  // Validate that the client splits match the mathematically expected splits
  const clientSplitsMap = new Map<string, Omit<ExpenseSplit, "baseAmountMinor">>();
  for (const s of splits) {
    clientSplitsMap.set(s.memberId, s);
  }

  const validatedSplits: ExpenseSplit[] = [];
  for (const exp of expectedSplits) {
    const clientSplit = clientSplitsMap.get(exp.memberId);
    if (!clientSplit) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Missing split configuration for expected participant ${exp.memberId}`
      );
    }
    if (clientSplit.amountMinor !== exp.amountMinor) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Split amount mismatch for ${exp.memberId}. Expected: ${exp.amountMinor}, got: ${clientSplit.amountMinor}`
      );
    }

    validatedSplits.push({
      memberId: exp.memberId,
      amountMinor: exp.amountMinor,
      baseAmountMinor: Math.round((exp.amountMinor * fxNumerator) / fxDenominator),
      percentageBps: clientSplit.percentageBps,
      shares: clientSplit.shares,
    });
  }

  return {
    validatedPayers,
    validatedSplits,
    baseAmountMinor,
  };
}

// Authentication check helper
function verifyAuth(context: functions.https.CallableContext): string {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication is required."
    );
  }
  return context.auth.uid;
}

// Load and verify group membership and roles
async function getGroupContext(
  transaction: admin.firestore.Transaction,
  groupId: string,
  userId: string
): Promise<{
  groupData: any;
  callerRole: "owner" | "admin" | "member" | "viewer";
  activeMemberIds: Set<string>;
}> {
  const groupRef = admin.firestore().doc(`groups/${groupId}`);
  const groupSnap = await transaction.get(groupRef);
  if (!groupSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Group not found.");
  }
  const groupData = groupSnap.data()!;
  if (groupData.status === "archived" || groupData.status === "deleted") {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Operations are blocked on archived or deleted groups."
    );
  }

  // Check caller membership
  const callerRef = admin.firestore().doc(`groups/${groupId}/members/${userId}`);
  const callerSnap = await transaction.get(callerRef);
  if (!callerSnap.exists) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "You are not a member of this group."
    );
  }
  const callerData = callerSnap.data()!;
  if (callerData.status !== "active") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Your membership in this group is not active."
    );
  }

  // Load all active member IDs for validation
  const membersRef = admin.firestore().collection(`groups/${groupId}/members`);
  const membersSnap = await transaction.get(membersRef);
  const activeMemberIds = new Set<string>();
  for (const doc of membersSnap.docs) {
    const data = doc.data();
    if (data.status === "active") {
      activeMemberIds.add(doc.id);
    }
  }

  return {
    groupData,
    callerRole: callerData.role,
    activeMemberIds,
  };
}

export async function executeCreateExpenseInTransaction(
  transaction: admin.firestore.Transaction,
  groupData: any,
  callerRole: "owner" | "admin" | "member" | "viewer",
  activeMemberIds: Set<string>,
  userId: string,
  data: CreateExpenseInput,
  hash: string
) {
  const {
    clientOperationId,
    groupId,
    expenseId,
    title,
    notes,
    category,
    incurredAtSeconds,
    currency,
    amountMinor,
    fxNumerator,
    fxDenominator,
    splitMethod,
    payers,
    splits,
    receiptId,
  } = data;

  if (callerRole === "viewer") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Viewers are not permitted to create expenses."
    );
  }

  // Validate that the expense does not already exist
  const expenseRef = admin.firestore().doc(`groups/${groupId}/expenses/${expenseId}`);
  const expenseSnap = await transaction.get(expenseRef);
  if (expenseSnap.exists) {
    throw new functions.https.HttpsError(
      "already-exists",
      "An expense with the specified expenseId already exists."
    );
  }

  // 3. Financial math validation
  const { validatedPayers, validatedSplits, baseAmountMinor } = validateFinancialPayload(
    amountMinor,
    currency,
    groupData.baseCurrency,
    fxNumerator,
    fxDenominator,
    splitMethod,
    payers,
    splits,
    activeMemberIds
  );

  // 4. Writes
  const newVersion = 1;
  const serverTimestamp = FieldValue.serverTimestamp();

  const expenseDoc: ExpenseDocument = {
    id: expenseId,
    groupId,
    title,
    notes: notes || "",
    category,
    incurredAt: Timestamp.fromMillis(incurredAtSeconds * 1000),
    currency,
    amountMinor,
    groupBaseCurrency: groupData.baseCurrency,
    baseAmountMinor,
    fx: {
      mode: currency === groupData.baseCurrency ? "same_currency" : "manual_snapshot",
      numerator: fxNumerator,
      denominator: fxDenominator,
    },
    splitMethod,
    payers: validatedPayers,
    splits: validatedSplits,
    payerMemberIds: validatedPayers.map((p) => p.memberId),
    participantMemberIds: validatedSplits.map((s) => s.memberId),
    status: "active",
    createdAt: serverTimestamp,
    createdBy: userId,
    updatedAt: serverTimestamp,
    updatedBy: userId,
    version: newVersion,
    schemaVersion: 1,
    latestOperationId: clientOperationId,
    receiptId: receiptId || null,
  };

  // Save main document
  transaction.set(expenseRef, expenseDoc);

  // If receiptId is present, validate and update the receipt document to status: "attached"
  if (receiptId) {
    const receiptRef = admin.firestore().doc(`groups/${groupId}/receipts/${receiptId}`);
    const receiptSnap = await transaction.get(receiptRef);
    if (!receiptSnap.exists) {
      throw new functions.https.HttpsError("not-found", "The specified receipt does not exist.");
    }
    const receiptData = receiptSnap.data()!;
    if (receiptData.status === "attached") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The specified receipt is already attached to another expense."
      );
    }
    
    const newReceiptVersion = receiptData.version + 1;
    transaction.update(receiptRef, {
      expenseId,
      status: "attached",
      version: newReceiptVersion,
      updatedAt: serverTimestamp,
      updatedBy: userId,
    });

    const receiptRevisionRef = admin.firestore().doc(
      `groups/${groupId}/receipts/${receiptId}/revisions/${newReceiptVersion}`
    );
    transaction.set(receiptRevisionRef, {
      ...receiptData,
      expenseId,
      status: "attached",
      version: newReceiptVersion,
      createdAt: serverTimestamp,
      operationId: clientOperationId,
    });
  }

  // Save immutable revision
  const revisionRef = admin.firestore().doc(
    `groups/${groupId}/expenses/${expenseId}/revisions/${newVersion}`
  );
  transaction.set(revisionRef, {
    ...expenseDoc,
    createdAt: serverTimestamp,
    operationId: clientOperationId,
  });

  // Save idempotency receipt
  const receipt: ExpenseOperationReceipt = {
    clientOperationId,
    groupId,
    type: "create",
    actorUid: userId,
    expenseId,
    payloadHash: hash,
    createdAt: serverTimestamp,
    result: {
      expenseId,
      version: newVersion,
    },
  };
  const opRef = admin.firestore().doc(`groups/${groupId}/expenseOperations/${clientOperationId}`);
  transaction.set(opRef, receipt);

  // Update group version & latestActivityAt
  const groupRef = admin.firestore().doc(`groups/${groupId}`);
  transaction.update(groupRef, {
    version: FieldValue.increment(1),
    latestActivityAt: serverTimestamp,
    updatedAt: serverTimestamp,
    updatedBy: userId,
  });

  // Write activity event
  const activityRef = admin.firestore().collection(`groups/${groupId}/activities`).doc();
  transaction.set(activityRef, {
    id: activityRef.id,
    groupId,
    type: "expense_created",
    actorUserId: userId,
    entityType: "expense",
    entityId: expenseId,
    summary: `Added expense: ${title}`,
    createdAt: serverTimestamp,
  });

  return {
    expenseId,
    version: newVersion,
  };
}

export async function handleCreateExpense(
  data: CreateExpenseInput,
  context: functions.https.CallableContext
) {
  const userId = verifyAuth(context);
  const { clientOperationId, groupId } = data;

  if (!clientOperationId || !groupId || !data.expenseId || !data.title || !data.category || !data.currency) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required fields for creating expense."
    );
  }

  const hash = computePayloadHash(data);

  return admin.firestore().runTransaction(async (transaction) => {
    // 1. Idempotency Check
    const opRef = admin.firestore().doc(`groups/${groupId}/expenseOperations/${clientOperationId}`);
    const opSnap = await transaction.get(opRef);
    if (opSnap.exists) {
      const opData = opSnap.data() as ExpenseOperationReceipt;
      if (opData.payloadHash !== hash) {
        throw new functions.https.HttpsError(
          "already-exists",
          "This clientOperationId has been reused with a different payload."
        );
      }
      return opData.result;
    }

    // 2. Fetch Group Context
    const { groupData, callerRole, activeMemberIds } = await getGroupContext(
      transaction,
      groupId,
      userId
    );

    return executeCreateExpenseInTransaction(
      transaction,
      groupData,
      callerRole,
      activeMemberIds,
      userId,
      data,
      hash
    );
  });
}

export async function handleUpdateExpense(
  data: UpdateExpenseInput,
  context: functions.https.CallableContext
) {
  const userId = verifyAuth(context);
  const {
    clientOperationId,
    groupId,
    expenseId,
    expectedVersion,
    title,
    notes,
    category,
    incurredAtSeconds,
    currency,
    amountMinor,
    fxNumerator,
    fxDenominator,
    splitMethod,
    payers,
    splits,
    receiptId,
  } = data;

  if (
    !clientOperationId ||
    !groupId ||
    !expenseId ||
    expectedVersion === undefined ||
    !title ||
    !category ||
    !currency
  ) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required fields for updating expense."
    );
  }

  const hash = computePayloadHash(data);

  return admin.firestore().runTransaction(async (transaction) => {
    // 1. Idempotency Check
    const opRef = admin.firestore().doc(`groups/${groupId}/expenseOperations/${clientOperationId}`);
    const opSnap = await transaction.get(opRef);
    if (opSnap.exists) {
      const opData = opSnap.data() as ExpenseOperationReceipt;
      if (opData.payloadHash !== hash) {
        throw new functions.https.HttpsError(
          "already-exists",
          "This clientOperationId has been reused with a different payload."
        );
      }
      return opData.result;
    }

    // 2. Fetch Group Context
    const { groupData, callerRole, activeMemberIds } = await getGroupContext(
      transaction,
      groupId,
      userId
    );

    // Fetch existing expense
    const expenseRef = admin.firestore().doc(`groups/${groupId}/expenses/${expenseId}`);
    const expenseSnap = await transaction.get(expenseRef);
    if (!expenseSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Expense not found.");
    }
    const currentExpense = expenseSnap.data() as ExpenseDocument;

    // Check void state
    if (currentExpense.status === "voided") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Voided expenses cannot be updated."
      );
    }

    // Check version lock
    if (currentExpense.version !== expectedVersion) {
      throw new functions.https.HttpsError(
        "aborted",
        "Conflict: The expense has been modified by another user.",
        {
          currentVersion: currentExpense.version,
          serverDocument: currentExpense,
        }
      );
    }

    // Check update permissions
    // Owner/Admin can update any; Members can only update their own created expenses
    if (callerRole === "viewer") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Viewers are not permitted to update expenses."
      );
    }
    if (callerRole === "member" && currentExpense.createdBy !== userId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Members can only update expenses created by themselves."
      );
    }

    // 3. Financial math validation
    const { validatedPayers, validatedSplits, baseAmountMinor } = validateFinancialPayload(
      amountMinor,
      currency,
      groupData.baseCurrency,
      fxNumerator,
      fxDenominator,
      splitMethod,
      payers,
      splits,
      activeMemberIds
    );

    // 4. Writes
    const newVersion = currentExpense.version + 1;
    const serverTimestamp = FieldValue.serverTimestamp();

    const expenseDoc: ExpenseDocument = {
      ...currentExpense,
      title,
      notes: notes || "",
      category,
      incurredAt: Timestamp.fromMillis(incurredAtSeconds * 1000),
      currency,
      amountMinor,
      baseAmountMinor,
      fx: {
        mode: currency === groupData.baseCurrency ? "same_currency" : "manual_snapshot",
        numerator: fxNumerator,
        denominator: fxDenominator,
      },
      splitMethod,
      payers: validatedPayers,
      splits: validatedSplits,
      payerMemberIds: validatedPayers.map((p) => p.memberId),
      participantMemberIds: validatedSplits.map((s) => s.memberId),
      updatedAt: serverTimestamp,
      updatedBy: userId,
      version: newVersion,
      latestOperationId: clientOperationId,
      receiptId: receiptId || currentExpense.receiptId || null,
    };

    // Save main document
    transaction.set(expenseRef, expenseDoc);

    // If new receiptId is specified and it differs from previous one, attach it
    if (receiptId && receiptId !== currentExpense.receiptId) {
      const receiptRef = admin.firestore().doc(`groups/${groupId}/receipts/${receiptId}`);
      const receiptSnap = await transaction.get(receiptRef);
      if (!receiptSnap.exists) {
        throw new functions.https.HttpsError("not-found", "The specified receipt does not exist.");
      }
      const receiptData = receiptSnap.data()!;
      if (receiptData.status === "attached") {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "The specified receipt is already attached to another expense."
        );
      }

      const newReceiptVersion = receiptData.version + 1;
      transaction.update(receiptRef, {
        expenseId,
        status: "attached",
        version: newReceiptVersion,
        updatedAt: serverTimestamp,
        updatedBy: userId,
      });

      const receiptRevisionRef = admin.firestore().doc(
        `groups/${groupId}/receipts/${receiptId}/revisions/${newReceiptVersion}`
      );
      transaction.set(receiptRevisionRef, {
        ...receiptData,
        expenseId,
        status: "attached",
        version: newReceiptVersion,
        createdAt: serverTimestamp,
        operationId: clientOperationId,
      });
    }

    // Save immutable revision
    const revisionRef = admin.firestore().doc(
      `groups/${groupId}/expenses/${expenseId}/revisions/${newVersion}`
    );
    transaction.set(revisionRef, {
      ...expenseDoc,
      createdAt: serverTimestamp,
      operationId: clientOperationId,
    });

    // Save idempotency receipt
    const receipt: ExpenseOperationReceipt = {
      clientOperationId,
      groupId,
      type: "update",
      actorUid: userId,
      expenseId,
      payloadHash: hash,
      createdAt: serverTimestamp,
      result: {
        expenseId,
        version: newVersion,
      },
    };
    transaction.set(opRef, receipt);

    // Update group version & latestActivityAt
    const groupRef = admin.firestore().doc(`groups/${groupId}`);
    transaction.update(groupRef, {
      version: FieldValue.increment(1),
      latestActivityAt: serverTimestamp,
      updatedAt: serverTimestamp,
      updatedBy: userId,
    });

    // Write activity event
    const activityRef = admin.firestore().collection(`groups/${groupId}/activities`).doc();
    transaction.set(activityRef, {
      id: activityRef.id,
      groupId,
      type: "expense_updated",
      actorUserId: userId,
      entityType: "expense",
      entityId: expenseId,
      summary: `Updated expense: ${title}`,
      createdAt: serverTimestamp,
    });

    return {
      expenseId,
      version: newVersion,
    };
  });
}

export async function handleVoidExpense(
  data: VoidExpenseInput,
  context: functions.https.CallableContext
) {
  const userId = verifyAuth(context);
  const { clientOperationId, groupId, expenseId, expectedVersion, voidReason } = data;

  if (!clientOperationId || !groupId || !expenseId || expectedVersion === undefined) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required fields for voiding expense."
    );
  }

  const hash = computePayloadHash(data);

  return admin.firestore().runTransaction(async (transaction) => {
    // 1. Idempotency Check
    const opRef = admin.firestore().doc(`groups/${groupId}/expenseOperations/${clientOperationId}`);
    const opSnap = await transaction.get(opRef);
    if (opSnap.exists) {
      const opData = opSnap.data() as ExpenseOperationReceipt;
      if (opData.payloadHash !== hash) {
        throw new functions.https.HttpsError(
          "already-exists",
          "This clientOperationId has been reused with a different payload."
        );
      }
      return opData.result;
    }

    // 2. Fetch Group Context
    const { callerRole } = await getGroupContext(transaction, groupId, userId);

    // Fetch existing expense
    const expenseRef = admin.firestore().doc(`groups/${groupId}/expenses/${expenseId}`);
    const expenseSnap = await transaction.get(expenseRef);
    if (!expenseSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Expense not found.");
    }
    const currentExpense = expenseSnap.data() as ExpenseDocument;

    // Check void state
    if (currentExpense.status === "voided") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Expense is already voided."
      );
    }

    // Check version lock
    if (currentExpense.version !== expectedVersion) {
      throw new functions.https.HttpsError(
        "aborted",
        "Conflict: The expense has been modified by another user.",
        {
          currentVersion: currentExpense.version,
          serverDocument: currentExpense,
        }
      );
    }

    // Check void permissions
    // Owner/Admin can void any; Members can only void their own created expenses
    if (callerRole === "viewer") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Viewers are not permitted to void expenses."
      );
    }
    if (callerRole === "member" && currentExpense.createdBy !== userId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Members can only void expenses created by themselves."
      );
    }

    // 4. Writes
    const newVersion = currentExpense.version + 1;
    const serverTimestamp = FieldValue.serverTimestamp();

    const expenseDoc: ExpenseDocument = {
      ...currentExpense,
      status: "voided",
      voidReason: voidReason || "",
      updatedAt: serverTimestamp,
      updatedBy: userId,
      version: newVersion,
      latestOperationId: clientOperationId,
    };

    // Save main document
    transaction.set(expenseRef, expenseDoc);

    // Save immutable revision
    const revisionRef = admin.firestore().doc(
      `groups/${groupId}/expenses/${expenseId}/revisions/${newVersion}`
    );
    transaction.set(revisionRef, {
      ...expenseDoc,
      createdAt: serverTimestamp,
      operationId: clientOperationId,
    });

    // Save idempotency receipt
    const receipt: ExpenseOperationReceipt = {
      clientOperationId,
      groupId,
      type: "void",
      actorUid: userId,
      expenseId,
      payloadHash: hash,
      createdAt: serverTimestamp,
      result: {
        expenseId,
        version: newVersion,
      },
    };
    transaction.set(opRef, receipt);

    // Update group version & latestActivityAt
    const groupRef = admin.firestore().doc(`groups/${groupId}`);
    transaction.update(groupRef, {
      version: FieldValue.increment(1),
      latestActivityAt: serverTimestamp,
      updatedAt: serverTimestamp,
      updatedBy: userId,
    });

    // Write activity event
    const activityRef = admin.firestore().collection(`groups/${groupId}/activities`).doc();
    transaction.set(activityRef, {
      id: activityRef.id,
      groupId,
      type: "expense_voided",
      actorUserId: userId,
      entityType: "expense",
      entityId: expenseId,
      summary: `Voided expense: ${currentExpense.title}`,
      createdAt: serverTimestamp,
    });

    return {
      expenseId,
      version: newVersion,
    };
  });
}
