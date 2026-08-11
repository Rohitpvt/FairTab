import { withAuth } from "../_lib/middleware.js";
import { getS3Client } from "../_lib/s3Client.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as admin from "firebase-admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- unavoidable cast due to ESM/CommonJS interop wrapper constraints for firebase-admin
const adminApp = admin as any;

interface ApiError extends Error {
  code?: string;
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

export default withAuth(async (req, res, context) => {
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

  const getObjectCommand = new GetObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
  });

  const downloadUrl = await getSignedUrl(s3, getObjectCommand, {
    expiresIn: 300,
  });

  return { downloadUrl };
});
