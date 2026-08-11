import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ensureFirebaseInitialized } from "./middleware.js";
import { handleScheduledDraftGeneration } from "../../functions/src/recurringOperations.js";

export async function handleCronRecurringDrafts(req: VercelRequest, res: VercelResponse) {
  // 1. Authorization Bearer <CRON_SECRET> Validation
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    res.status(401).json({ code: "unauthenticated", message: "CRON_SECRET environment variable is missing" });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ code: "unauthenticated", message: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.substring(7);
  if (token !== cronSecret) {
    res.status(401).json({ code: "unauthenticated", message: "Unauthorized" });
    return;
  }

  const startTime = Date.now();
  try {
    // 2. Reuse standard GCP OIDC / Firebase Admin initialization
    await ensureFirebaseInitialized();

    // 3. Execute deterministic generation
    const result = await handleScheduledDraftGeneration();

    const duration = Date.now() - startTime;

    // 4. Return operational logs (no user financial details or secrets)
    res.status(200).json({
      templatesScanned: result.templatesScanned,
      draftsCreated: result.totalCreated,
      templatesSkipped: result.templatesSkipped,
      errors: result.errors,
      executionDate: new Date().toISOString(),
      duration: `${duration}ms`
    });
  } catch (error: unknown) {
    console.error("Cron execution failed:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      code: "internal",
      message: "Cron execution failed",
      error: errMsg
    });
  }
}
