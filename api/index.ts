import { withAuth, createHandlerContext } from "./_lib/middleware.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleDeleteAccount, handleUpdateProfile, handleRepairProfile } from "../functions/src/accountOperations.js";
import { handleCreateBudget, handleUpdateBudget, handleDeleteBudget } from "../functions/src/budgetOperations.js";
import { handleCreateExpense, handleUpdateExpense, handleVoidExpense } from "../functions/src/expenseOperations.js";
import { handleDeleteGroup } from "../functions/src/groupOperations.js";
import { handleCreateReceipt, handleProcessReceiptOCR } from "../functions/src/receiptOperations.js";
import {
  handleApproveRecurringDraft,
  handleCreateRecurringTemplate,
  handleGenerateRecurringDrafts,
  handleSkipRecurringOccurrence,
  handleUpdateRecurringTemplate
} from "../functions/src/recurringOperations.js";
import {
  handleCreateSettlement,
  handleVoidSettlement,
  handleSettleExpenseSplit,
  handleUnsettleExpenseSplit,
} from "../functions/src/settlementOperations.js";
import {
  handleCreateEmailInvitation,
  handleAcceptEmailInvitation,
  handleCreateGlobalInviteLink,
  handleRevokeGlobalInviteLink,
  handleRequestJoinViaGlobalLink,
  handleApproveJoinRequest,
  handleDeclineJoinRequest,
  handleResolveInviteToken
} from "../functions/src/invitationOperations.js";
import { getS3Client } from "./_lib/s3Client.js";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { handleCronRecurringDrafts } from "./_lib/cronRecurringDrafts.js";
import admin from "firebase-admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adminApp = admin as any;

interface ApiError extends Error {
  code?: string;
}

async function authorizeUserForGroup(groupId: string, userId: string): Promise<void> {
  const groupRef = adminApp.firestore().doc(`groups/${groupId}`);
  const groupSnap = await groupRef.get();
  if (!groupSnap.exists) {
    const err = new Error("Group not found") as ApiError;
    err.code = "not-found";
    throw err;
  }
  const groupData = groupSnap.data()!;
  if (groupData.status === "archived" || groupData.status === "deleted") {
    const err = new Error("Group is archived or deleted") as ApiError;
    err.code = "failed-precondition";
    throw err;
  }

  const memberRef = adminApp.firestore().doc(`groups/${groupId}/members/${userId}`);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) {
    const err = new Error("User is not a member of the group") as ApiError;
    err.code = "permission-denied";
    throw err;
  }
  const memberData = memberSnap.data()!;
  if (memberData.status !== "active") {
    const err = new Error("User's membership is inactive") as ApiError;
    err.code = "permission-denied";
    throw err;
  }
  if (memberData.role === "viewer") {
    const err = new Error("Viewers are not permitted to upload files") as ApiError;
    err.code = "permission-denied";
    throw err;
  }
}

async function verifyGroupMembership(groupId: string, userId: string): Promise<void> {
  const memberRef = adminApp.firestore().doc(`groups/${groupId}/members/${userId}`);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) {
    const err = new Error("User is not a member of the group") as ApiError;
    err.code = "permission-denied";
    throw err;
  }
  const memberData = memberSnap.data()!;
  if (memberData.status !== "active") {
    const err = new Error("User's membership is inactive") as ApiError;
    err.code = "permission-denied";
    throw err;
  }
}

// Route map
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- unavoidable cast to map standard route handlers dynamically
const standardHandlers: Record<string, (data: any, context: any) => Promise<any>> = {
  "/api/accounts/delete": handleDeleteAccount,
  "/api/accounts/update-profile": handleUpdateProfile,
  "/api/accounts/repair-profile": handleRepairProfile,
  "/api/budgets/create": handleCreateBudget,
  "/api/budgets/delete": handleDeleteBudget,
  "/api/budgets/update": handleUpdateBudget,
  "/api/expenses/create": handleCreateExpense,
  "/api/expenses/update": handleUpdateExpense,
  "/api/expenses/void": handleVoidExpense,
  "/api/groups/delete": handleDeleteGroup,
  "/api/receipts/create": handleCreateReceipt,
  "/api/receipts/process-ocr": handleProcessReceiptOCR,
  "/api/recurring/approve-draft": handleApproveRecurringDraft,
  "/api/recurring/create-template": handleCreateRecurringTemplate,
  "/api/recurring/generate-drafts": handleGenerateRecurringDrafts,
  "/api/recurring/skip-occurrence": handleSkipRecurringOccurrence,
  "/api/recurring/update-template": handleUpdateRecurringTemplate,
  "/api/settlements/create": handleCreateSettlement,
  "/api/settlements/void": handleVoidSettlement,
  "/api/settlements/settle-split": handleSettleExpenseSplit,
  "/api/settlements/unsettle-split": handleUnsettleExpenseSplit,
  "/api/invitations/create-email": handleCreateEmailInvitation,
  "/api/invitations/accept-email": handleAcceptEmailInvitation,
  "/api/invitations/create-global": handleCreateGlobalInviteLink,
  "/api/invitations/revoke-global": handleRevokeGlobalInviteLink,
  "/api/invitations/request-join-global": handleRequestJoinViaGlobalLink,
  "/api/invitations/approve-join-request": handleApproveJoinRequest,
  "/api/invitations/decline-join-request": handleDeclineJoinRequest,
  "/api/invitations/resolve-token": handleResolveInviteToken,
};

const authenticatedRouter = withAuth(async (req, res, context) => {
  // Parse clean URL path
  const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
  let path = url.pathname;
  if (path.endsWith("/")) {
    path = path.slice(0, -1);
  }

  // Handle presign upload/download
  if (path === "/api/receipts/presign-upload") {
    const { groupId, receiptId, fileName, fileType } = req.body;
    if (!groupId || !receiptId || !fileName || !fileType) {
      res.status(400).json({ code: "invalid-argument", message: "Missing required fields" });
      return;
    }
    await authorizeUserForGroup(groupId, context.uid);
    const allowedMime = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowedMime.includes(fileType)) {
      res.status(400).json({
        code: "invalid-argument",
        message: `MIME type ${fileType} is not allowed. Must be jpeg, png, or pdf.`,
      });
      return;
    }
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const objectKey = `groups/${groupId}/receipts/${receiptId}/v1/${sanitizedFileName}`;
    const s3 = getS3Client();
    const bucketName = process.env.AWS_S3_BUCKET || "fairtab-48340-receipts";
    const presignedPost = await createPresignedPost(s3, {
      Bucket: bucketName,
      Key: objectKey,
      Conditions: [
        ["content-length-range", 0, 5242880], // Max 5 MB
        {"Content-Type": fileType},
      ],
      Fields: {
        "Content-Type": fileType,
      },
      Expires: 300,
    });
    return { url: presignedPost.url, fields: presignedPost.fields, objectKey };
  }

  if (path === "/api/receipts/presign-download") {
    const { groupId, receiptId } = req.body;
    if (!groupId || !receiptId) {
      res.status(400).json({ code: "invalid-argument", message: "Missing required fields" });
      return;
    }
    await verifyGroupMembership(groupId, context.uid);
    const receiptRef = adminApp.firestore().doc(`groups/${groupId}/receipts/${receiptId}`);
    const receiptSnap = await receiptRef.get();
    if (!receiptSnap.exists) {
      res.status(404).json({ code: "not-found", message: "Receipt not found" });
      return;
    }
    const receiptData = receiptSnap.data()!;
    const objectKey = receiptData.storagePath || receiptData.objectKey;
    if (!objectKey) {
      res.status(400).json({ code: "failed-precondition", message: "Receipt has no storage path key" });
      return;
    }
    const s3 = getS3Client();
    const bucketName = process.env.AWS_S3_BUCKET || "fairtab-48340-receipts";
    const getObjectCommand = new GetObjectCommand({ Bucket: bucketName, Key: objectKey });
    const downloadUrl = await getSignedUrl(s3, getObjectCommand, { expiresIn: 300 });
    return { downloadUrl };
  }

  // Look up route handler
  const handler = standardHandlers[path];
  if (!handler) {
    res.status(404).json({ code: "not-found", message: `API Endpoint ${path} not found` });
    return;
  }

  return handler(req.body, createHandlerContext(context.uid, context.token));
});

export default async function (req: VercelRequest, res: VercelResponse) {
  const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
  let path = url.pathname;
  if (path.endsWith("/")) {
    path = path.slice(0, -1);
  }

  if (path === "/api/cron/recurring-drafts") {
    return handleCronRecurringDrafts(req, res);
  }

  return authenticatedRouter(req, res);
}
