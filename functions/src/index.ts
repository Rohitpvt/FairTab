import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

// Initialize Firebase Admin SDK
admin.initializeApp();
admin.firestore().settings({ ignoreUndefinedProperties: true });

import {
  handleCreateExpense,
  handleUpdateExpense,
  handleVoidExpense,
} from "./expenseOperations.js";

import {
  handleCreateSettlement,
  handleVoidSettlement,
} from "./settlementOperations.js";

import {
  handleCreateReceipt,
  handleProcessReceiptOCR,
} from "./receiptOperations.js";

import {
  handleCreateRecurringTemplate,
  handleUpdateRecurringTemplate,
  handleGenerateRecurringDrafts,
  handleScheduledDraftGeneration,
  handleApproveRecurringDraft,
  handleSkipRecurringOccurrence,
} from "./recurringOperations.js";

import {
  handleCreateBudget,
  handleUpdateBudget,
  handleDeleteBudget,
} from "./budgetOperations.js";

import { handleDeleteGroup } from "./groupOperations.js";
import { handleDeleteAccount } from "./accountOperations.js";

export const createExpense = functions.https.onCall(handleCreateExpense);
export const updateExpense = functions.https.onCall(handleUpdateExpense);
export const voidExpense = functions.https.onCall(handleVoidExpense);

export const createSettlement = functions.https.onCall(handleCreateSettlement);
export const voidSettlement = functions.https.onCall(handleVoidSettlement);

export const createReceipt = functions.https.onCall(handleCreateReceipt);
export const processReceiptOCR = functions.https.onCall(handleProcessReceiptOCR);

export const createRecurringTemplate = functions.https.onCall(handleCreateRecurringTemplate);
export const updateRecurringTemplate = functions.https.onCall(handleUpdateRecurringTemplate);
export const generateRecurringDrafts = functions.https.onCall(handleGenerateRecurringDrafts);
export const approveRecurringDraft = functions.https.onCall(handleApproveRecurringDraft);
export const skipRecurringOccurrence = functions.https.onCall(handleSkipRecurringOccurrence);

export const createBudget = functions.https.onCall(handleCreateBudget);
export const updateBudget = functions.https.onCall(handleUpdateBudget);
export const deleteBudget = functions.https.onCall(handleDeleteBudget);

export const deleteGroup = functions.https.onCall(handleDeleteGroup);
export const deleteAccount = functions.https.onCall(handleDeleteAccount);

// Scheduled draft generation
// NOTE: Scheduled functions use Cloud Scheduler and require standard/blaze billing configuration in Google Cloud.
export const generateDueRecurringDraftsScheduled = functions.pubsub
  .schedule("every 24 hours")
  .onRun(async () => {
    return handleScheduledDraftGeneration();
  });

