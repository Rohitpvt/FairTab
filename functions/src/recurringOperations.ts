/* eslint-disable @typescript-eslint/no-explicit-any */
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { FieldValue } from "firebase-admin/firestore";
import {
  executeCreateExpenseInTransaction,
  computePayloadHash,
} from "./expenseOperations.js";
import {
  ExpenseCategory,
  SplitMethod,
  ExpensePayer,
  ExpenseSplit,
  calculateOccurrenceSequence,
  getOccurrenceDate,
  getLocalDateInTimezone,
  splitEqual,
} from "@fairtab/domain";

// Helper to verify authentication
function verifyAuth(context: functions.https.CallableContext): string {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication is required."
    );
  }
  return context.auth.uid;
}

// Load and verify group context
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

// ----------------------------------------------------
// 1. Create Recurring Template
// ----------------------------------------------------
interface CreateTemplateInput {
  clientOperationId: string;
  groupId: string;
  templateId: string;
  title: string;
  notes?: string;
  category: ExpenseCategory;
  amountMinor: number;
  currency: string;
  fxNumerator: number;
  fxDenominator: number;
  splitMethod: SplitMethod;
  payers: Omit<ExpensePayer, "baseAmountMinor">[];
  splits: Omit<ExpenseSplit, "baseAmountMinor">[];
  schedule: {
    frequency: "daily" | "weekly" | "monthly" | "yearly";
    interval: number;
    startLocalDate: string; // YYYY-MM-DD
    endDate?: string | null;
  };
  timeZone: string;
}

export async function handleCreateRecurringTemplate(
  data: CreateTemplateInput,
  context: functions.https.CallableContext
) {
  const userId = verifyAuth(context);
  const {
    clientOperationId,
    groupId,
    templateId,
    title,
    notes,
    category,
    amountMinor,
    currency,
    fxNumerator,
    fxDenominator,
    splitMethod,
    payers,
    splits,
    schedule,
    timeZone,
  } = data;

  if (
    !clientOperationId ||
    !groupId ||
    !templateId ||
    !title ||
    !category ||
    !currency ||
    !schedule ||
    !timeZone
  ) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required fields for creating recurring template."
    );
  }

  const hash = computePayloadHash(data);

  return admin.firestore().runTransaction(async (transaction) => {
    // Idempotency check
    const opRef = admin.firestore().doc(`groups/${groupId}/recurringOperations/${clientOperationId}`);
    const opSnap = await transaction.get(opRef);
    if (opSnap.exists) {
      const opData = opSnap.data()!;
      if (opData.payloadHash !== hash) {
        throw new functions.https.HttpsError(
          "already-exists",
          "This clientOperationId has been reused with a different payload."
        );
      }
      return opData.result;
    }

    // Fetch context
    const { groupData, callerRole, activeMemberIds } = await getGroupContext(
      transaction,
      groupId,
      userId
    );

    if (callerRole === "viewer") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Viewers are not permitted to create recurring templates."
      );
    }

    // Check template ID unique
    const templateRef = admin.firestore().doc(`groups/${groupId}/recurringTemplates/${templateId}`);
    const templateSnap = await transaction.get(templateRef);
    if (templateSnap.exists) {
      throw new functions.https.HttpsError(
        "already-exists",
        "A template with the specified templateId already exists."
      );
    }

    // Validate splits and payers involve active group members
    for (const p of payers) {
      if (!activeMemberIds.has(p.memberId)) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          `Payer ${p.memberId} is not an active member.`
        );
      }
    }
    for (const s of splits) {
      if (!activeMemberIds.has(s.memberId)) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          `Split participant ${s.memberId} is not an active member.`
        );
      }
    }

    const serverTimestamp = FieldValue.serverTimestamp();

    // Map base amount minor
    const validatedPayers: ExpensePayer[] = payers.map((p) => ({
      memberId: p.memberId,
      amountMinor: p.amountMinor,
      baseAmountMinor: Math.round((p.amountMinor * fxNumerator) / fxDenominator),
    }));
    const validatedSplits: ExpenseSplit[] = splits.map((s) => ({
      memberId: s.memberId,
      amountMinor: s.amountMinor,
      baseAmountMinor: Math.round((s.amountMinor * fxNumerator) / fxDenominator),
      percentageBps: s.percentageBps,
      shares: s.shares,
    }));

    const baseAmountMinor = Math.round((amountMinor * fxNumerator) / fxDenominator);

    const templateDoc = {
      id: templateId,
      groupId,
      title,
      notes: notes || "",
      category,
      amountMinor,
      currency,
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
      schedule: {
        frequency: schedule.frequency,
        interval: schedule.interval,
        startLocalDate: schedule.startLocalDate,
        endDate: schedule.endDate || null,
      },
      timeZone,
      status: "active" as const,
      nextOccurrenceDate: schedule.startLocalDate,
      lastProcessedDate: null,
      createdAt: serverTimestamp,
      createdBy: userId,
      updatedAt: serverTimestamp,
      updatedBy: userId,
      version: 1,
      schemaVersion: 1,
    };

    transaction.set(templateRef, templateDoc);

    // Save operation receipt
    transaction.set(opRef, {
      clientOperationId,
      groupId,
      type: "create_template",
      actorUid: userId,
      templateId,
      payloadHash: hash,
      createdAt: serverTimestamp,
      result: { templateId },
    });

    // Write activity event
    const activityRef = admin.firestore().collection(`groups/${groupId}/activities`).doc();
    transaction.set(activityRef, {
      id: activityRef.id,
      groupId,
      type: "template_created",
      actorUserId: userId,
      entityType: "recurringTemplate",
      entityId: templateId,
      summary: `Created recurring template: ${title}`,
      createdAt: serverTimestamp,
    });

    return { templateId };
  });
}

// ----------------------------------------------------
// 2. Update Recurring Template (Pause/Resume, splits etc.)
// ----------------------------------------------------
interface UpdateTemplateInput {
  clientOperationId: string;
  groupId: string;
  templateId: string;
  status?: "active" | "paused" | "ended";
  schedule?: {
    frequency?: "daily" | "weekly" | "monthly" | "yearly";
    interval?: number;
    startLocalDate?: string;
    endDate?: string | null;
  };
  payers?: Omit<ExpensePayer, "baseAmountMinor">[];
  splits?: Omit<ExpenseSplit, "baseAmountMinor">[];
}

export async function handleUpdateRecurringTemplate(
  data: UpdateTemplateInput,
  context: functions.https.CallableContext
) {
  const userId = verifyAuth(context);
  const { clientOperationId, groupId, templateId, status, schedule, payers, splits } = data;

  if (!clientOperationId || !groupId || !templateId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required fields for updating template."
    );
  }

  const hash = computePayloadHash(data);

  return admin.firestore().runTransaction(async (transaction) => {
    // Idempotency check
    const opRef = admin.firestore().doc(`groups/${groupId}/recurringOperations/${clientOperationId}`);
    const opSnap = await transaction.get(opRef);
    if (opSnap.exists) {
      return opSnap.data()!.result;
    }

    const { callerRole, activeMemberIds } = await getGroupContext(transaction, groupId, userId);

    const templateRef = admin.firestore().doc(`groups/${groupId}/recurringTemplates/${templateId}`);
    const templateSnap = await transaction.get(templateRef);
    if (!templateSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Template not found.");
    }
    const templateData = templateSnap.data()!;

    // Check permissions: Owner/Admin can update any; Member can only update their own
    if (callerRole !== "owner" && callerRole !== "admin") {
      if (templateData.createdBy !== userId) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "You are not permitted to modify this template."
        );
      }
    }

    const serverTimestamp = FieldValue.serverTimestamp();
    const updates: any = {
      updatedAt: serverTimestamp,
      updatedBy: userId,
      version: (templateData.version || 1) + 1,
    };

    if (status !== undefined) {
      updates.status = status;
    }

    if (schedule !== undefined) {
      updates.schedule = {
        ...templateData.schedule,
        ...schedule,
      };
      // If startLocalDate changes, re-evaluate nextOccurrenceDate
      if (schedule.startLocalDate !== undefined) {
        updates.nextOccurrenceDate = schedule.startLocalDate;
      }
    }

    if (payers !== undefined) {
      for (const p of payers) {
        if (!activeMemberIds.has(p.memberId)) {
          throw new functions.https.HttpsError(
            "invalid-argument",
            `Payer ${p.memberId} is not active.`
          );
        }
      }
      updates.payers = payers.map((p) => ({
        memberId: p.memberId,
        amountMinor: p.amountMinor,
        baseAmountMinor: Math.round(
          (p.amountMinor * templateData.fx.numerator) / templateData.fx.denominator
        ),
      }));
      updates.payerMemberIds = payers.map((p) => p.memberId);
    }

    if (splits !== undefined) {
      for (const s of splits) {
        if (!activeMemberIds.has(s.memberId)) {
          throw new functions.https.HttpsError(
            "invalid-argument",
            `Split participant ${s.memberId} is not active.`
          );
        }
      }
      updates.splits = splits.map((s) => ({
        memberId: s.memberId,
        amountMinor: s.amountMinor,
        baseAmountMinor: Math.round(
          (s.amountMinor * templateData.fx.numerator) / templateData.fx.denominator
        ),
        percentageBps: s.percentageBps,
        shares: s.shares,
      }));
      updates.participantMemberIds = splits.map((s) => s.memberId);
    }

    transaction.update(templateRef, updates);

    // Save operation receipt
    transaction.set(opRef, {
      clientOperationId,
      groupId,
      type: "update_template",
      actorUid: userId,
      templateId,
      payloadHash: hash,
      createdAt: serverTimestamp,
      result: { templateId },
    });

    return { templateId };
  });
}

// ----------------------------------------------------
// 3. Generate Draft Reminders / Occurrences
// ----------------------------------------------------
export async function executeGenerateDraftsForGroup(groupId: string, nowMs: number) {
  const db = admin.firestore();

  // Load group
  const groupRef = db.doc(`groups/${groupId}`);
  const groupSnap = await groupRef.get();
  if (!groupSnap.exists || groupSnap.data()?.status === "archived" || groupSnap.data()?.status === "deleted") {
    return { createdCount: 0 };
  }

  // Load active group members
  const membersSnap = await db.collection(`groups/${groupId}/members`).get();
  const activeMemberIds = new Set<string>();
  const activeMemberDocs: any[] = [];
  for (const doc of membersSnap.docs) {
    const data = doc.data();
    if (data.status === "active") {
      activeMemberIds.add(doc.id);
      activeMemberDocs.push(data);
    }
  }

  const templatesSnap = await db.collection(`groups/${groupId}/recurringTemplates`).get();
  let createdCount = 0;

  for (const templateDoc of templatesSnap.docs) {
    const template = templateDoc.data();
    if (template.status !== "active") {
      continue;
    }

    // Determine current local date string in template's timezone
    const limitDate = getLocalDateInTimezone(nowMs, template.timeZone);

    // Calculate occurrences from nextOccurrenceDate up to limitDate
    const dates = calculateOccurrenceSequence(
      template.nextOccurrenceDate,
      template.schedule.frequency,
      template.schedule.interval,
      limitDate,
      template.schedule.endDate
    );

    if (dates.length === 0) {
      continue;
    }

    for (const occDate of dates) {
      // Deterministic path: groups/{groupId}/recurringTemplates/{templateId}/occurrences/{occurrenceDate}
      const occRef = db.doc(
        `groups/${groupId}/recurringTemplates/${template.id}/occurrences/${occDate}`
      );
      const occSnap = await occRef.get();
      if (occSnap.exists) {
        continue; // Already processed
      }

      // Check removed/left members
      let validationError: string | null = null;
      let recalculatedSplits: ExpenseSplit[] | null = null;

      // 1. Payers verification
      for (const p of template.payers) {
        if (!activeMemberIds.has(p.memberId)) {
          validationError = `Payer ${p.memberId} is no longer active in the group.`;
        }
      }

      // 2. Splits verification
      const missingParticipants: string[] = [];
      for (const s of template.splits) {
        if (!activeMemberIds.has(s.memberId)) {
          missingParticipants.push(s.memberId);
        }
      }

      if (missingParticipants.length > 0) {
        if (template.splitMethod === "equal") {
          // Recalculate equal split among remaining active participants
          const activeParticipants = template.splits
            .map((s: any) => s.memberId)
            .filter((id: string) => activeMemberIds.has(id));

          if (activeParticipants.length > 0) {
            const newSplits = splitEqual(template.amountMinor, activeParticipants);
            recalculatedSplits = newSplits.map((ns) => ({
              memberId: ns.memberId,
              amountMinor: ns.amountMinor,
              baseAmountMinor: Math.round(
                (ns.amountMinor * template.fx.numerator) / template.fx.denominator
              ),
            }));
          } else {
            validationError = "All split participants have been removed from this group.";
          }
        } else {
          // Non-equal splits: flag for manual repair
          validationError = `Split participants (${missingParticipants.join(
            ", "
          )}) are no longer active in the group.`;
        }
      }

      // Write occurrence draft
      await occRef.set({
        id: occDate,
        templateId: template.id,
        groupId,
        occurrenceDate: occDate,
        status: "pending",
        validationError,
        recalculatedSplits,
        createdAt: FieldValue.serverTimestamp(),
        schemaVersion: 1,
      });

      createdCount++;
    }

    // Update nextOccurrenceDate in template to the occurrence after limitDate
    const lastCalculatedDate = dates[dates.length - 1];
    // Find index of lastCalculatedDate in the occurrence progression to compute the next one
    let index = 0;
    while (true) {
      const d = getOccurrenceDate(
        template.schedule.startLocalDate,
        template.schedule.frequency,
        template.schedule.interval,
        index
      );
      if (d === lastCalculatedDate) {
        const nextDate = getOccurrenceDate(
          template.schedule.startLocalDate,
          template.schedule.frequency,
          template.schedule.interval,
          index + 1
        );
        await templateDoc.ref.update({
          nextOccurrenceDate: nextDate,
          lastProcessedDate: lastCalculatedDate,
          updatedAt: FieldValue.serverTimestamp(),
        });
        break;
      }
      index++;
      if (index > 1000) break; // guard
    }
  }

  return { createdCount };
}

export async function handleGenerateRecurringDrafts(
  data: { groupId: string },
  context: functions.https.CallableContext
) {
  const userId = verifyAuth(context);
  const { groupId } = data;

  if (!groupId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing groupId parameter."
    );
  }

  // Direct caller permission check (must be member)
  const memberSnap = await admin
    .firestore()
    .doc(`groups/${groupId}/members/${userId}`)
    .get();
  if (!memberSnap.exists || memberSnap.data()?.status !== "active") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "You must be an active member of the group."
    );
  }

  return executeGenerateDraftsForGroup(groupId, Date.now());
}

// ----------------------------------------------------
// 4. Scheduled Function: generateDueRecurringDraftsScheduled
// ----------------------------------------------------
export async function handleScheduledDraftGeneration() {
  const db = admin.firestore();
  const groupsSnap = await db.collection("groups").get();
  let totalCreated = 0;

  for (const groupDoc of groupsSnap.docs) {
    const group = groupDoc.data();
    if (group.status === "active") {
      try {
        const res = await executeGenerateDraftsForGroup(group.id, Date.now());
        totalCreated += res.createdCount;
      } catch (err) {
        console.error(`Error generating drafts for group ${group.id}:`, err);
      }
    }
  }

  console.log(`Scheduled draft generation complete. Created ${totalCreated} pending drafts.`);
  return { totalCreated };
}

// ----------------------------------------------------
// 5. Approve Recurring Draft / Occurrence
// ----------------------------------------------------
interface ApproveDraftInput {
  clientOperationId: string;
  groupId: string;
  templateId: string;
  occurrenceDate: string; // YYYY-MM-DD (Occurrence ID)
  expenseId: string;
  adjustedSplits?: Omit<ExpenseSplit, "baseAmountMinor">[];
  adjustedPayers?: Omit<ExpensePayer, "baseAmountMinor">[];
}

export async function handleApproveRecurringDraft(
  data: ApproveDraftInput,
  context: functions.https.CallableContext
) {
  const userId = verifyAuth(context);
  const {
    clientOperationId,
    groupId,
    templateId,
    occurrenceDate,
    expenseId,
    adjustedSplits,
    adjustedPayers,
  } = data;

  if (!clientOperationId || !groupId || !templateId || !occurrenceDate || !expenseId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required fields for draft approval."
    );
  }

  const hash = computePayloadHash(data);

  return admin.firestore().runTransaction(async (transaction) => {
    // Idempotency check
    const opRef = admin.firestore().doc(`groups/${groupId}/recurringOperations/${clientOperationId}`);
    const opSnap = await transaction.get(opRef);
    if (opSnap.exists) {
      return opSnap.data()!.result;
    }

    const { groupData, callerRole, activeMemberIds } = await getGroupContext(
      transaction,
      groupId,
      userId
    );

    if (callerRole === "viewer") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Viewers are not permitted to approve occurrences."
      );
    }

    // Load occurrence document
    const occRef = admin.firestore().doc(
      `groups/${groupId}/recurringTemplates/${templateId}/occurrences/${occurrenceDate}`
    );
    const occSnap = await transaction.get(occRef);
    if (!occSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Occurrence draft not found.");
    }
    const occData = occSnap.data()!;
    if (occData.status !== "pending") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Occurrence draft has already been actioned."
      );
    }

    // Load template settings
    const templateRef = admin.firestore().doc(`groups/${groupId}/recurringTemplates/${templateId}`);
    const templateSnap = await transaction.get(templateRef);
    const templateData = templateSnap.data()!;

    // Enforce split repair check
    const finalSplits = adjustedSplits || occData.recalculatedSplits || templateData.splits;
    const finalPayers = adjustedPayers || templateData.payers;

    // Check validation error
    if (occData.validationError && !adjustedSplits && !adjustedPayers) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Approval is blocked: ${occData.validationError}. Please provide manually corrected splits/payers.`
      );
    }

    // Convert occurrenceDate (YYYY-MM-DD) into seconds-since-epoch at UTC noon
    const [y, m, d] = occurrenceDate.split("-").map(Number);
    const incurredAtSeconds = Date.UTC(y, m - 1, d, 12, 0, 0) / 1000;

    // Re-use core expense creation logic
    const expensePayload: any = {
      clientOperationId,
      groupId,
      expenseId,
      title: `${templateData.title} (${occurrenceDate})`,
      notes: templateData.notes || "",
      category: templateData.category,
      incurredAtSeconds,
      currency: templateData.currency,
      amountMinor: templateData.amountMinor,
      fxNumerator: templateData.fx.numerator,
      fxDenominator: templateData.fx.denominator,
      splitMethod: templateData.splitMethod,
      payers: finalPayers.map((p: any) => ({ memberId: p.memberId, amountMinor: p.amountMinor })),
      splits: finalSplits.map((s: any) => ({
        memberId: s.memberId,
        amountMinor: s.amountMinor,
        percentageBps: s.percentageBps,
        shares: s.shares,
      })),
    };

    const expenseHash = computePayloadHash(expensePayload);

    await executeCreateExpenseInTransaction(
      transaction,
      groupData,
      callerRole,
      activeMemberIds,
      userId,
      expensePayload,
      expenseHash
    );

    // Update occurrence state
    const serverTimestamp = FieldValue.serverTimestamp();
    transaction.update(occRef, {
      status: "approved",
      expenseId,
      actionedAt: serverTimestamp,
      actionedBy: userId,
    });

    // Save operation receipt
    transaction.set(opRef, {
      clientOperationId,
      groupId,
      type: "approve_occurrence",
      actorUid: userId,
      templateId,
      occurrenceDate,
      payloadHash: hash,
      createdAt: serverTimestamp,
      result: { expenseId },
    });

    return { expenseId };
  });
}

// ----------------------------------------------------
// 6. Skip Occurrence
// ----------------------------------------------------
interface SkipOccurrenceInput {
  clientOperationId: string;
  groupId: string;
  templateId: string;
  occurrenceDate: string; // YYYY-MM-DD
}

export async function handleSkipRecurringOccurrence(
  data: SkipOccurrenceInput,
  context: functions.https.CallableContext
) {
  const userId = verifyAuth(context);
  const { clientOperationId, groupId, templateId, occurrenceDate } = data;

  if (!clientOperationId || !groupId || !templateId || !occurrenceDate) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required fields for skipping occurrence."
    );
  }

  const hash = computePayloadHash(data);

  return admin.firestore().runTransaction(async (transaction) => {
    // Idempotency check
    const opRef = admin.firestore().doc(`groups/${groupId}/recurringOperations/${clientOperationId}`);
    const opSnap = await transaction.get(opRef);
    if (opSnap.exists) {
      return opSnap.data()!.result;
    }

    const { callerRole } = await getGroupContext(transaction, groupId, userId);
    if (callerRole === "viewer") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Viewers are not permitted to skip occurrences."
      );
    }

    // Load occurrence document
    const occRef = admin.firestore().doc(
      `groups/${groupId}/recurringTemplates/${templateId}/occurrences/${occurrenceDate}`
    );
    const occSnap = await transaction.get(occRef);
    if (!occSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Occurrence draft not found.");
    }
    const occData = occSnap.data()!;
    if (occData.status !== "pending") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Occurrence has already been actioned."
      );
    }

    const serverTimestamp = FieldValue.serverTimestamp();
    transaction.update(occRef, {
      status: "skipped",
      actionedAt: serverTimestamp,
      actionedBy: userId,
    });

    // Save operation receipt
    transaction.set(opRef, {
      clientOperationId,
      groupId,
      type: "skip_occurrence",
      actorUid: userId,
      templateId,
      occurrenceDate,
      payloadHash: hash,
      createdAt: serverTimestamp,
      result: { success: true },
    });

    return { success: true };
  });
}
