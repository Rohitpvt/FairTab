/* eslint-disable @typescript-eslint/no-explicit-any */
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { FieldValue } from "firebase-admin/firestore";
import { computePayloadHash } from "./expenseOperations.js";
import type { ExpenseCategory } from "@fairtab/domain";

const VALID_CATEGORIES: ExpenseCategory[] = [
  "food", "transport", "shopping", "housing", "utilities",
  "entertainment", "health", "travel", "education", "other",
];

// ── Create Budget ──

interface CreateBudgetInput {
  clientOperationId: string;
  groupId: string;
  budgetId: string;
  name: string;
  scope: "overall" | "category" | "member";
  category?: ExpenseCategory;
  memberId?: string;
  period: "weekly" | "monthly" | "custom";
  timeZone: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string | null;
  amountMinor: number;
  currency: string;
}

export async function handleCreateBudget(
  data: CreateBudgetInput,
  context: functions.https.CallableContext
): Promise<{ budgetId: string; version: number }> {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }

  const uid = context.auth.uid;
  const {
    clientOperationId, groupId, budgetId, name, scope,
    category, memberId, period, timeZone, startDate, endDate,
    amountMinor, currency,
  } = data;

  // Validate required fields
  if (!clientOperationId || !groupId || !budgetId || !name || !scope || !period || !timeZone || !startDate || !currency) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields.");
  }

  if (typeof amountMinor !== "number" || !Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new functions.https.HttpsError("invalid-argument", "amountMinor must be a positive integer.");
  }

  if (!["overall", "category", "member"].includes(scope)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid scope.");
  }

  if (!["weekly", "monthly", "custom"].includes(period)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid period.");
  }

  if (scope === "category") {
    if (!category || !VALID_CATEGORIES.includes(category)) {
      throw new functions.https.HttpsError("invalid-argument", "Category required for category scope.");
    }
  }

  if (scope === "member" && !memberId) {
    throw new functions.https.HttpsError("invalid-argument", "memberId required for member scope.");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    throw new functions.https.HttpsError("invalid-argument", "startDate must be YYYY-MM-DD.");
  }

  const db = admin.firestore();
  const groupRef = db.doc(`groups/${groupId}`);
  const memberRef = db.doc(`groups/${groupId}/members/${uid}`);
  const budgetRef = db.doc(`groups/${groupId}/budgets/${budgetId}`);
  const opRef = db.doc(`groups/${groupId}/budgetOperations/${clientOperationId}`);

  const payloadHash = computePayloadHash({ ...data, type: "create" });

  return db.runTransaction(async (tx) => {
    // Idempotency check
    const opSnap = await tx.get(opRef);
    if (opSnap.exists) {
      const existing = opSnap.data()!;
      if (existing.payloadHash === payloadHash) {
        return existing.result;
      }
      throw new functions.https.HttpsError("already-exists", "Duplicate operation with different payload.");
    }

    const groupSnap = await tx.get(groupRef);
    if (!groupSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Group not found.");
    }
    const groupData = groupSnap.data()!;

    if (groupData.status === "archived" || groupData.status === "deleted") {
      throw new functions.https.HttpsError("failed-precondition", "Cannot create budget in archived or deleted group.");
    }

    if (!groupData.memberUserIds.includes(uid)) {
      throw new functions.https.HttpsError("permission-denied", "Not a group member.");
    }

    // Check role
    const memberSnap = await tx.get(memberRef);
    if (!memberSnap.exists || memberSnap.data()!.status !== "active") {
      throw new functions.https.HttpsError("permission-denied", "Not an active member.");
    }
    const memberData = memberSnap.data()!;
    const role = memberData.role;

    // Permission: owner/admin can create any budget. Member can create personal budgets only.
    if (role !== "owner" && role !== "admin") {
      if (scope === "member") {
        // Member can only create budgets for themselves
        if (memberId !== memberSnap.id) {
          throw new functions.https.HttpsError("permission-denied", "Members can only create personal budgets.");
        }
      } else {
        throw new functions.https.HttpsError("permission-denied", "Only owner/admin can create group budgets.");
      }
    }

    // If scope === member, verify target member exists
    if (scope === "member" && memberId) {
      const targetMemberRef = db.doc(`groups/${groupId}/members/${memberId}`);
      const targetSnap = await tx.get(targetMemberRef);
      if (!targetSnap.exists || targetSnap.data()!.status !== "active") {
        throw new functions.https.HttpsError("not-found", "Target member not found or inactive.");
      }
    }

    const now = FieldValue.serverTimestamp();
    const budgetDoc = {
      id: budgetId,
      groupId,
      name,
      scope,
      ...(scope === "category" && category ? { category } : {}),
      ...(scope === "member" && memberId ? { memberId } : {}),
      period,
      timeZone,
      startDate,
      endDate: endDate || null,
      amountMinor,
      currency,
      status: "active",
      createdAt: now,
      createdBy: uid,
      updatedAt: now,
      updatedBy: uid,
      version: 1,
      schemaVersion: 1,
      latestOperationId: clientOperationId,
    };

    const revision = {
      id: "1",
      budgetId,
      groupId,
      name,
      scope,
      ...(scope === "category" && category ? { category } : {}),
      ...(scope === "member" && memberId ? { memberId } : {}),
      period,
      timeZone,
      startDate,
      endDate: endDate || null,
      amountMinor,
      currency,
      status: "active",
      version: 1,
      schemaVersion: 1,
      operationId: clientOperationId,
      createdAt: now,
      createdBy: uid,
    };

    const opReceipt = {
      clientOperationId,
      groupId,
      type: "create",
      actorUid: uid,
      budgetId,
      payloadHash,
      createdAt: now,
      result: { budgetId, version: 1 },
    };

    tx.set(budgetRef, budgetDoc);
    tx.set(budgetRef.collection("revisions").doc("1"), revision);
    tx.set(opRef, opReceipt);

    return { budgetId, version: 1 };
  });
}

// ── Update Budget ──

interface UpdateBudgetInput {
  clientOperationId: string;
  groupId: string;
  budgetId: string;
  expectedVersion: number;
  name: string;
  scope: "overall" | "category" | "member";
  category?: ExpenseCategory;
  memberId?: string;
  period: "weekly" | "monthly" | "custom";
  timeZone: string;
  startDate: string;
  endDate?: string | null;
  amountMinor: number;
  currency: string;
  status: "active" | "paused";
}

export async function handleUpdateBudget(
  data: UpdateBudgetInput,
  context: functions.https.CallableContext
): Promise<{ budgetId: string; version: number }> {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }

  const uid = context.auth.uid;
  const {
    clientOperationId, groupId, budgetId, expectedVersion,
    name, scope, category, memberId, period, timeZone,
    startDate, endDate, amountMinor, currency, status,
  } = data;

  if (!clientOperationId || !groupId || !budgetId || !name || !scope || !period || !timeZone || !startDate || !currency || !status) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields.");
  }

  if (typeof expectedVersion !== "number" || expectedVersion < 1) {
    throw new functions.https.HttpsError("invalid-argument", "expectedVersion must be >= 1.");
  }

  if (typeof amountMinor !== "number" || !Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new functions.https.HttpsError("invalid-argument", "amountMinor must be a positive integer.");
  }

  if (!["active", "paused"].includes(status)) {
    throw new functions.https.HttpsError("invalid-argument", "Status must be active or paused for updates.");
  }

  const db = admin.firestore();
  const groupRef = db.doc(`groups/${groupId}`);
  const memberRef = db.doc(`groups/${groupId}/members/${uid}`);
  const budgetRef = db.doc(`groups/${groupId}/budgets/${budgetId}`);
  const opRef = db.doc(`groups/${groupId}/budgetOperations/${clientOperationId}`);

  const payloadHash = computePayloadHash({ ...data, type: "update" });

  return db.runTransaction(async (tx) => {
    const opSnap = await tx.get(opRef);
    if (opSnap.exists) {
      const existing = opSnap.data()!;
      if (existing.payloadHash === payloadHash) {
        return existing.result;
      }
      throw new functions.https.HttpsError("already-exists", "Duplicate operation with different payload.");
    }

    const groupSnap = await tx.get(groupRef);
    if (!groupSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Group not found.");
    }
    if (groupSnap.data()!.status === "archived" || groupSnap.data()!.status === "deleted") {
      throw new functions.https.HttpsError("failed-precondition", "Cannot update budget in archived or deleted group.");
    }
    if (!groupSnap.data()!.memberUserIds.includes(uid)) {
      throw new functions.https.HttpsError("permission-denied", "Not a group member.");
    }

    const memberSnap = await tx.get(memberRef);
    if (!memberSnap.exists || memberSnap.data()!.status !== "active") {
      throw new functions.https.HttpsError("permission-denied", "Not an active member.");
    }
    const role = memberSnap.data()!.role;

    const budgetSnap = await tx.get(budgetRef);
    if (!budgetSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Budget not found.");
    }
    const budgetData = budgetSnap.data()!;

    if (budgetData.status === "deleted") {
      throw new functions.https.HttpsError("failed-precondition", "Cannot update a deleted budget.");
    }

    if (budgetData.version !== expectedVersion) {
      throw new functions.https.HttpsError("failed-precondition", `Version conflict: expected ${expectedVersion}, found ${budgetData.version}.`);
    }

    // Permission check
    if (role !== "owner" && role !== "admin") {
      if (budgetData.scope === "member" && budgetData.memberId === memberSnap.id) {
        // Member can update their own personal budget
      } else {
        throw new functions.https.HttpsError("permission-denied", "Only owner/admin can update group budgets.");
      }
    }

    const newVersion = budgetData.version + 1;
    const now = FieldValue.serverTimestamp();

    const updates: any = {
      name,
      scope,
      period,
      timeZone,
      startDate,
      endDate: endDate || null,
      amountMinor,
      currency,
      status,
      updatedAt: now,
      updatedBy: uid,
      version: newVersion,
      latestOperationId: clientOperationId,
    };

    if (scope === "category" && category) {
      updates.category = category;
    }
    if (scope === "member" && memberId) {
      updates.memberId = memberId;
    }

    const revision = {
      id: String(newVersion),
      budgetId,
      groupId,
      name,
      scope,
      ...(scope === "category" && category ? { category } : {}),
      ...(scope === "member" && memberId ? { memberId } : {}),
      period,
      timeZone,
      startDate,
      endDate: endDate || null,
      amountMinor,
      currency,
      status,
      version: newVersion,
      schemaVersion: 1,
      operationId: clientOperationId,
      createdAt: now,
      createdBy: uid,
    };

    const opReceipt = {
      clientOperationId,
      groupId,
      type: "update",
      actorUid: uid,
      budgetId,
      payloadHash,
      createdAt: now,
      result: { budgetId, version: newVersion },
    };

    tx.update(budgetRef, updates);
    tx.set(budgetRef.collection("revisions").doc(String(newVersion)), revision);
    tx.set(opRef, opReceipt);

    return { budgetId, version: newVersion };
  });
}

// ── Delete Budget (Soft-delete) ──

interface DeleteBudgetInput {
  clientOperationId: string;
  groupId: string;
  budgetId: string;
  expectedVersion: number;
}

export async function handleDeleteBudget(
  data: DeleteBudgetInput,
  context: functions.https.CallableContext
): Promise<{ budgetId: string; version: number }> {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }

  const uid = context.auth.uid;
  const { clientOperationId, groupId, budgetId, expectedVersion } = data;

  if (!clientOperationId || !groupId || !budgetId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields.");
  }

  if (typeof expectedVersion !== "number" || expectedVersion < 1) {
    throw new functions.https.HttpsError("invalid-argument", "expectedVersion must be >= 1.");
  }

  const db = admin.firestore();
  const groupRef = db.doc(`groups/${groupId}`);
  const memberRef = db.doc(`groups/${groupId}/members/${uid}`);
  const budgetRef = db.doc(`groups/${groupId}/budgets/${budgetId}`);
  const opRef = db.doc(`groups/${groupId}/budgetOperations/${clientOperationId}`);

  const payloadHash = computePayloadHash({ ...data, type: "delete" });

  return db.runTransaction(async (tx) => {
    const opSnap = await tx.get(opRef);
    if (opSnap.exists) {
      const existing = opSnap.data()!;
      if (existing.payloadHash === payloadHash) {
        return existing.result;
      }
      throw new functions.https.HttpsError("already-exists", "Duplicate operation with different payload.");
    }

    const groupSnap = await tx.get(groupRef);
    if (!groupSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Group not found.");
    }
    if (groupSnap.data()!.status === "archived" || groupSnap.data()!.status === "deleted") {
      throw new functions.https.HttpsError("failed-precondition", "Cannot delete budget in archived or deleted group.");
    }
    if (!groupSnap.data()!.memberUserIds.includes(uid)) {
      throw new functions.https.HttpsError("permission-denied", "Not a group member.");
    }

    const memberSnap = await tx.get(memberRef);
    if (!memberSnap.exists || memberSnap.data()!.status !== "active") {
      throw new functions.https.HttpsError("permission-denied", "Not an active member.");
    }
    const role = memberSnap.data()!.role;

    const budgetSnap = await tx.get(budgetRef);
    if (!budgetSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Budget not found.");
    }
    const budgetData = budgetSnap.data()!;

    if (budgetData.status === "deleted") {
      // Already deleted — idempotent
      return { budgetId, version: budgetData.version };
    }

    if (budgetData.version !== expectedVersion) {
      throw new functions.https.HttpsError("failed-precondition", `Version conflict: expected ${expectedVersion}, found ${budgetData.version}.`);
    }

    // Permission check
    if (role !== "owner" && role !== "admin") {
      if (budgetData.scope === "member" && budgetData.memberId === memberSnap.id) {
        // Member can delete their own personal budget
      } else {
        throw new functions.https.HttpsError("permission-denied", "Only owner/admin can delete group budgets.");
      }
    }

    const newVersion = budgetData.version + 1;
    const now = FieldValue.serverTimestamp();

    // Preserve original creation metadata, only change status + version
    tx.update(budgetRef, {
      status: "deleted",
      updatedAt: now,
      updatedBy: uid,
      version: newVersion,
      latestOperationId: clientOperationId,
    });

    tx.set(budgetRef.collection("revisions").doc(String(newVersion)), {
      id: String(newVersion),
      budgetId,
      groupId,
      name: budgetData.name,
      scope: budgetData.scope,
      ...(budgetData.category ? { category: budgetData.category } : {}),
      ...(budgetData.memberId ? { memberId: budgetData.memberId } : {}),
      period: budgetData.period,
      timeZone: budgetData.timeZone,
      startDate: budgetData.startDate,
      endDate: budgetData.endDate || null,
      amountMinor: budgetData.amountMinor,
      currency: budgetData.currency,
      status: "deleted",
      version: newVersion,
      schemaVersion: 1,
      operationId: clientOperationId,
      createdAt: now,
      createdBy: uid,
    });

    tx.set(opRef, {
      clientOperationId,
      groupId,
      type: "delete",
      actorUid: uid,
      budgetId,
      payloadHash,
      createdAt: now,
      result: { budgetId, version: newVersion },
    });

    return { budgetId, version: newVersion };
  });
}
