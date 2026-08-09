/* eslint-disable @typescript-eslint/no-explicit-any */
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import type {
  ReceiptDocument,
  ReceiptRevision,
  ReceiptOperationReceipt,
  ReceiptItem,
} from "@fairtab/domain";

// Canonicalization helper for consistency hash
function canonicalizePayload(val: any): any {
  if (val === null || val === undefined) return val;
  if (Array.isArray(val)) {
    return val.map(canonicalizePayload);
  }
  if (typeof val === "object") {
    const sortedObj: any = {};
    Object.keys(val)
      .sort()
      .forEach((key) => { sortedObj[key] = canonicalizePayload(val[key]); });
    return sortedObj;
  }
  return val;
}

function computePayloadHash(payload: any): string {
  const canonical = canonicalizePayload(payload);
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonical))
    .digest("hex");
}

// Verification helper
function verifyAuth(context: functions.https.CallableContext): string {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication required to perform this operation."
    );
  }
  return context.auth.uid;
}

// Check group status & caller role helper
async function getGroupContext(
  transaction: admin.firestore.Transaction,
  groupId: string,
  userId: string
) {
  const groupRef = admin.firestore().doc(`groups/${groupId}`);
  const groupSnap = await transaction.get(groupRef);
  if (!groupSnap.exists) {
    throw new functions.https.HttpsError("not-found", "The specified group does not exist.");
  }
  const groupData = groupSnap.data()!;

  const memberRef = admin.firestore().doc(`groups/${groupId}/members/${userId}`);
  const memberSnap = await transaction.get(memberRef);
  if (!memberSnap.exists) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "User is not a member of this group."
    );
  }
  const memberData = memberSnap.data()!;
  if (memberData.status !== "active") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "User's membership is inactive or left/removed."
    );
  }

  const activeMemberIds = new Set<string>(groupData.memberUserIds || []);
  if (!activeMemberIds.has(userId)) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "User is not in the active member index."
    );
  }

  return { groupData, callerRole: memberData.role };
}

// ----------------------------------------------------
// OCR Provider Abstraction
// ----------------------------------------------------
export interface OcrExtractionResult {
  merchant: string;
  date: string;
  currency: string;
  subtotal: number;
  tax: number;
  tip: number;
  discount: number;
  total: number;
  confidence: Record<string, number>;
  items: {
    description: string;
    amountMinor: number;
    confidence: number;
  }[];
  /** True when using a simulated/mock OCR provider instead of a real one. */
  isSimulated: boolean;
  /** Human-readable name of the OCR provider used for this extraction. */
  providerName: string;
}

export interface OcrProvider {
  extract(storagePath: string): Promise<OcrExtractionResult>;
}

export class MockOcrProvider implements OcrProvider {
  async extract(storagePath: string): Promise<OcrExtractionResult> {
    // IMPORTANT: This is a SIMULATED OCR provider for development/testing.
    // Replace with a real provider (Google Vision, AWS Textract, etc.) for production.
    // Generate deterministic mock based on storagePath suffix to allow E2E consistency
    const isMockB = storagePath.toLowerCase().includes("mock_b") || storagePath.toLowerCase().includes("receipt_b");
    if (isMockB) {
      return {
        merchant: "Hardware Depot",
        date: "2026-08-01",
        currency: "USD",
        subtotal: 8000, // $80.00
        tax: 800, // $8.00
        tip: 1000, // $10.00
        discount: 500, // $5.00
        total: 9300, // $80.00 + $8.00 + $10.00 - $5.00 = $93.00
        confidence: {
          merchant: 0.98,
          date: 0.95,
          currency: 0.99,
          subtotal: 0.97,
          tax: 0.40, // low confidence!
          tip: 0.90,
          discount: 0.35, // low confidence!
          total: 0.99,
        },
        items: [
          { description: "Hammer Claw heavy", amountMinor: 3000, confidence: 0.91 },
          { description: "Nails Box 100x", amountMinor: 1500, confidence: 0.45 }, // low confidence!
          { description: "Power Drill Battery Pack", amountMinor: 3500, confidence: 0.96 },
        ],
        isSimulated: true,
        providerName: "MockOcrProvider (Simulated)",
      };
    }

    // Default mock response
    return {
      merchant: "Supermarket Plaza",
      date: new Date().toISOString().split("T")[0],
      currency: "USD",
      subtotal: 4500, // $45.00
      tax: 400, // $4.00
      tip: 500, // $5.00
      discount: 200, // $2.00
      total: 5200, // $45.00 + $4.00 + $5.00 - $2.00 = $52.00
      confidence: {
        merchant: 0.95,
        date: 0.90,
        currency: 0.99,
        subtotal: 0.98,
        tax: 0.45, // low confidence!
        tip: 0.85,
        discount: 0.50, // low confidence!
        total: 0.98,
      },
      items: [
        { description: "Organic Apple bag", amountMinor: 1200, confidence: 0.92 },
        { description: "Clean Soap Liquid", amountMinor: 1800, confidence: 0.35 }, // low confidence!
        { description: "Towel Soft Roll", amountMinor: 1500, confidence: 0.88 },
      ],
      isSimulated: true,
      providerName: "MockOcrProvider (Simulated)",
    };
  }
}

const defaultOcrProvider: OcrProvider = new MockOcrProvider();

// ----------------------------------------------------
// Functions Implementation
// ----------------------------------------------------

interface CreateReceiptInput {
  clientOperationId: string;
  groupId: string;
  receiptId: string;
  fileName: string;
  fileType: string;
  storagePath: string;
  ocrResult?: {
    merchant: string;
    date: string;
    currency: string;
    subtotal: number;
    tax: number;
    tip: number;
    discount: number;
    total: number;
    confidence: Record<string, number>;
    items: ReceiptItem[];
  };
}

export async function handleCreateReceipt(
  data: CreateReceiptInput,
  context: functions.https.CallableContext
) {
  const userId = verifyAuth(context);
  const { clientOperationId, groupId, receiptId, fileName, fileType, storagePath, ocrResult } = data;

  if (!clientOperationId || !groupId || !receiptId || !fileName || !fileType || !storagePath) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required fields for creating receipt."
    );
  }

  // 1. Verify Storage object actually exists and matches criteria (trusted server validation)
  try {
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    const [metadata] = await file.getMetadata();

    // Verify expected path structure matches: groups/{groupId}/receipts/{receiptId}/v{version}/{fileName}
    // Storage emulator returns storagePath as the file name/path
    const pathParts = storagePath.split("/");
    if (
      pathParts.length < 6 ||
      pathParts[0] !== "groups" ||
      pathParts[1] !== groupId ||
      pathParts[2] !== "receipts" ||
      pathParts[3] !== receiptId ||
      !pathParts[4].startsWith("v")
    ) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Storage path does not conform to the expected receipt directory structure."
      );
    }

    // Verify size (max 5MB = 5,242,880 bytes)
    const fileSize = parseInt(String(metadata.size || "0"), 10);
    if (fileSize <= 0 || fileSize > 5 * 1024 * 1024) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Receipt file size (${fileSize} bytes) exceeds the 5MB limit.`
      );
    }

    // Verify MIME type allowlist
    const mimeType = metadata.contentType || "";
    if (
      mimeType !== "image/jpeg" &&
      mimeType !== "image/png" &&
      mimeType !== "application/pdf"
    ) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Receipt file MIME type (${mimeType}) is not allowed. Must be jpeg, png, or pdf.`
      );
    }

  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError(
      "not-found",
      `Failed to validate uploaded Storage file: ${error.message || String(error)}`
    );
  }

  const hash = computePayloadHash(data);

  return admin.firestore().runTransaction(async (transaction) => {
    // 2. Idempotency Check
    const opRef = admin.firestore().doc(`groups/${groupId}/receiptOperations/${clientOperationId}`);
    const opSnap = await transaction.get(opRef);
    if (opSnap.exists) {
      const opData = opSnap.data() as ReceiptOperationReceipt;
      if (opData.payloadHash !== hash) {
        throw new functions.https.HttpsError(
          "already-exists",
          "This clientOperationId has been reused with a different payload."
        );
      }
      return opData.result;
    }

    // 3. Group membership check
    const { groupData, callerRole } = await getGroupContext(transaction, groupId, userId);
    if (groupData.status === "archived" || groupData.status === "deleted") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Cannot create receipt in an archived or deleted group."
      );
    }
    if (callerRole === "viewer") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Viewers are not permitted to upload/create receipts."
      );
    }

    // 4. Validate Receipt ID is unique
    const receiptRef = admin.firestore().doc(`groups/${groupId}/receipts/${receiptId}`);
    const receiptSnap = await transaction.get(receiptRef);
    if (receiptSnap.exists) {
      throw new functions.https.HttpsError(
        "already-exists",
        "A receipt with the specified receiptId already exists."
      );
    }

    // 5. Build Receipt Document
    const newVersion = 1;
    const serverTimestamp = FieldValue.serverTimestamp();

    const receiptDoc: ReceiptDocument = {
      id: receiptId,
      groupId,
      fileName,
      fileType,
      storagePath,
      status: "uploaded",
      version: newVersion,
      ocrResult: ocrResult || undefined,
      expenseId: null,
      createdAt: serverTimestamp,
      createdBy: userId,
      updatedAt: serverTimestamp,
      updatedBy: userId,
      schemaVersion: 1,
    };

    transaction.set(receiptRef, receiptDoc);

    // 6. Write Immutable Revision
    const revisionRef = admin.firestore().doc(
      `groups/${groupId}/receipts/${receiptId}/revisions/${newVersion}`
    );
    const revisionDoc: ReceiptRevision = {
      id: String(newVersion),
      receiptId,
      groupId,
      fileName,
      fileType,
      storagePath,
      status: "uploaded",
      version: newVersion,
      ocrResult: ocrResult || undefined,
      expenseId: null,
      operationId: clientOperationId,
      createdAt: serverTimestamp,
      createdBy: userId,
    };
    transaction.set(revisionRef, revisionDoc);

    // 7. Save Idempotency Receipt
    const receiptReceipt: ReceiptOperationReceipt = {
      clientOperationId,
      groupId,
      type: "create",
      actorUid: userId,
      receiptId,
      payloadHash: hash,
      createdAt: serverTimestamp,
      result: {
        receiptId,
        version: newVersion,
      },
    };
    transaction.set(opRef, receiptReceipt);

    // 8. Update Group Version
    const groupRef = admin.firestore().doc(`groups/${groupId}`);
    transaction.update(groupRef, {
      version: FieldValue.increment(1),
      latestActivityAt: serverTimestamp,
      updatedAt: serverTimestamp,
      updatedBy: userId,
    });

    // 9. Write Activity Timeline Event
    const activityRef = admin.firestore().collection(`groups/${groupId}/activities`).doc();
    transaction.set(activityRef, {
      id: activityRef.id,
      groupId,
      type: "receipt_uploaded",
      actorUserId: userId,
      entityId: receiptId,
      summary: `Uploaded receipt "${fileName}" for review.`,
      createdAt: serverTimestamp,
    });

    return {
      receiptId,
      version: newVersion,
    };
  });
}

interface ProcessOcrInput {
  groupId: string;
  storagePath: string;
}

export async function handleProcessReceiptOCR(
  data: ProcessOcrInput,
  context: functions.https.CallableContext
) {
  const userId = verifyAuth(context);
  const { groupId, storagePath } = data;

  if (!groupId || !storagePath) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required fields for processing receipt OCR."
    );
  }

  // Verify group access and membership status
  const db = admin.firestore();
  const memberRef = db.doc(`groups/${groupId}/members/${userId}`);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists || memberSnap.data()?.status !== "active") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "User is not an active member of this group."
    );
  }

  try {
    const result = await defaultOcrProvider.extract(storagePath);
    return result;
  } catch (error: any) {
    throw new functions.https.HttpsError(
      "internal",
      `OCR extraction failed: ${error.message || String(error)}`
    );
  }
}
