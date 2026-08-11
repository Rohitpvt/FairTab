import { S3Client } from "@aws-sdk/client-s3";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";

let s3ClientInstance: S3Client | null = null;

export function getS3Client(): S3Client {
  if (s3ClientInstance) return s3ClientInstance;

  const region = process.env.AWS_REGION || "ap-south-1";

  if (process.env.VERCEL && process.env.AWS_ROLE_ARN) {
    s3ClientInstance = new S3Client({
      region,
      credentials: awsCredentialsProvider({
        roleArn: process.env.AWS_ROLE_ARN!,
      }),
    });
  } else {
    // Fallback for local development or CI/CD test emulators
    s3ClientInstance = new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "mock-access-key",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "mock-secret-key",
      },
    });
  }

  return s3ClientInstance;
}
