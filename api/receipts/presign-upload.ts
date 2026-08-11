import { withAuth } from "../_lib/middleware.js";
import { getS3Client } from "../_lib/s3Client.js";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import * as admin from "firebase-admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- unavoidable cast due to ESM/CommonJS interop wrapper constraints for firebase-admin
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

export default withAuth(async (req, res, context) => {
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
  const version = 1;
  const objectKey = `groups/${groupId}/receipts/${receiptId}/v${version}/${sanitizedFileName}`;

  const s3 = getS3Client();
  const bucketName = process.env.AWS_S3_BUCKET || "fairtab-48340-receipts";

  const presignedPost = await createPresignedPost(s3, {
    Bucket: bucketName,
    Key: objectKey,
    Conditions: [
      ["content-length-range", 0, 5242880],
      {"Content-Type": fileType},
    ],
    Fields: {
      "Content-Type": fileType,
    },
    Expires: 300,
  });

  return {
    url: presignedPost.url,
    fields: presignedPost.fields,
    objectKey,
  };
});
