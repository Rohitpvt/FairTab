import type { VercelRequest, VercelResponse } from "@vercel/node";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import admin from "firebase-admin";
import { getVercelOidcToken } from "@vercel/oidc";

interface DecodedToken {
  uid: string;
  [key: string]: unknown;
}

interface ApiError extends Error {
  code?: string;
  details?: unknown;
}

let isInitialized = false;

export async function ensureFirebaseInitialized() {
  const useOidc = !!(
    process.env.VERCEL &&
    process.env.GCP_PROJECT_NUMBER &&
    process.env.GCP_SERVICE_ACCOUNT_EMAIL &&
    process.env.GCP_WORKLOAD_IDENTITY_POOL_ID &&
    process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID
  );

  if (useOidc) {
    const vercelToken = await getVercelOidcToken();
    const fs = await import("fs/promises");
    await fs.writeFile("/tmp/vercel-oidc-token.txt", vercelToken, "utf8");
  }

  if (isInitialized) return;

  const activeApps = getApps();
  if (activeApps.length > 0) {
    isInitialized = true;
    return;
  }

  const projectId = process.env.GCP_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "mock-project-id";
  const clientEmail = process.env.GCP_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.GCP_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY;

  if (useOidc) {
    const fs = await import("fs/promises");
    const gcpConfig = {
      type: "external_account",
      audience: `//iam.googleapis.com/projects/${process.env.GCP_PROJECT_NUMBER}/locations/global/workloadIdentityPools/${process.env.GCP_WORKLOAD_IDENTITY_POOL_ID}/providers/${process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID}`,
      subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
      token_url: "https://sts.googleapis.com/v1/token",
      service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${process.env.GCP_SERVICE_ACCOUNT_EMAIL}:generateAccessToken`,
      credential_source: {
        file: "/tmp/vercel-oidc-token.txt"
      }
    };
    await fs.writeFile("/tmp/gcp-credentials.json", JSON.stringify(gcpConfig, null, 2), "utf8");
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "/tmp/gcp-credentials.json";

    const originalGac = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    initializeApp({
      projectId,
    });
    if (originalGac) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = originalGac;
    }
  } else if (projectId && clientEmail && privateKey) {
    const credentialFactory = admin.credential || (admin as unknown as { default?: { credential?: typeof admin.credential } }).default?.credential;
    if (!credentialFactory) {
      throw new Error("Firebase Admin credential factory not found");
    }
    initializeApp({
      credential: credentialFactory.cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, "\n"),
      }),
    });
  } else {
    initializeApp({ projectId });
  }

  getFirestore().settings({ ignoreUndefinedProperties: true });
  isInitialized = true;
}

export interface AuthContext {
  uid: string;
  token: DecodedToken;
}

export type AuthenticatedHandler = (
  req: VercelRequest,
  res: VercelResponse,
  context: AuthContext
) => Promise<unknown>;

export function createHandlerContext(uid: string, token?: DecodedToken) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- unavoidable mock context cast required by shared backend business logic parameter signature
  return { auth: { uid, token } } as any;
}

export function withAuth(handler: AuthenticatedHandler) {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      await ensureFirebaseInitialized();
    } catch (e) {
      console.error("Firebase initialization failed:", e);
      res.status(500).json({ code: "internal", message: "Failed to initialize Firebase Admin" });
      return;
    }
    // CORS headers
    const origin = req.headers.origin;
    const allowedOrigin = "https://rohitpvt.github.io";

    if (origin === allowedOrigin || !process.env.VERCEL) {
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

    if (req.method === "OPTIONS") {
      res.status(200).end();
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ code: "method-not-allowed", message: "Only POST requests are allowed" });
      return;
    }

    // Verify Firebase ID token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ code: "unauthenticated", message: "Missing or invalid authorization header" });
      return;
    }

    const token = authHeader.substring(7);
    if (!token || token === "undefined") {
      res.status(401).json({ code: "unauthenticated", message: "Unauthenticated" });
      return;
    }
    try {
      const decodedToken = await getAuth().verifyIdToken(token);
      const context: AuthContext = {
        uid: decodedToken.uid,
        token: decodedToken,
      };

      const result = await handler(req, res, context);
      if (!res.writableEnded) {
        res.status(200).json(result);
      }
    } catch (error) {
      console.error("API error:", error);
      const apiErr = error as ApiError;
      let code = apiErr.code || "internal";
      if (typeof code === "string" && code.startsWith("auth/")) {
        code = "unauthenticated";
      }
      const message = apiErr.message || "Internal server error";
      const details = apiErr.details || null;
      
      const httpStatus = mapFirebaseErrorToStatus(code);
      res.status(httpStatus).json({ code, message, details });
    }
  };
}

function mapFirebaseErrorToStatus(code: string): number {
  switch (code) {
    case "invalid-argument": return 400;
    case "unauthenticated": return 401;
    case "permission-denied": return 403;
    case "not-found": return 404;
    case "already-exists": return 409;
    case "failed-precondition": return 412;
    case "resource-exhausted": return 429;
    case "internal": return 500;
    default: return 500;
  }
}
