import { auth } from "../firebase/firebase";

const getBaseUrl = (): string => {
  let url = import.meta.env.VITE_API_BASE_URL || "https://fairtab-api.vercel.app";
  if (!url && typeof process !== "undefined" && process.env.NODE_ENV === "test") {
    url = "http://localhost";
  }
  // Strip trailing slash if present
  return url.endsWith("/") ? url.slice(0, -1) : url;
};

interface ApiError extends Error {
  code?: string;
  details?: unknown;
}

const PATH_TO_FUNCTION: Record<string, string> = {
  "expenses/create": "createExpense",
  "expenses/update": "updateExpense",
  "expenses/void": "voidExpense",
  "settlements/create": "createSettlement",
  "settlements/approve": "approveSettlement",
  "settlements/reject": "rejectSettlement",
  "settlements/cancel": "cancelSettlement",
  "settlements/void": "voidSettlement",
  "settlements/settle-split": "settleExpenseSplit",
  "settlements/unsettle-split": "unsettleExpenseSplit",
  "budgets/create": "createBudget",
  "budgets/update": "updateBudget",
  "budgets/delete": "deleteBudget",
  "recurring/create-template": "createRecurringTemplate",
  "recurring/update-template": "updateRecurringTemplate",
  "recurring/generate-drafts": "generateRecurringDrafts",
  "recurring/approve-draft": "approveRecurringDraft",
  "recurring/skip-occurrence": "skipRecurringOccurrence",
  "receipts/create": "createReceipt",
  "receipts/process-ocr": "processReceiptOCR",
  "groups/delete": "deleteGroup",
  "groups/transfer-ownership": "transferGroupOwnership",
  "accounts/delete": "deleteAccount",
  "accounts/update-profile": "updateProfile",
  "accounts/repair-profile": "repairProfile",
  "invitations/create-email": "createEmailInvitation",
  "invitations/accept-email": "acceptEmailInvitation",
  "invitations/create-global": "createGlobalInviteLink",
  "invitations/revoke-global": "revokeGlobalInviteLink",
  "invitations/request-join-global": "requestJoinViaGlobalLink",
  "invitations/approve-join-request": "approveJoinRequest",
  "invitations/decline-join-request": "declineJoinRequest",
};

const mapPathToFunction = (path: string): string => {
  const cleanPath = path.replace(/^\/?api\//, "").replace(/^\//, "");
  return PATH_TO_FUNCTION[cleanPath] || "";
};

async function postRequest<TInput = unknown, TOutput = unknown>(
  path: string,
  data: TInput
): Promise<TOutput> {
  const useEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";

  if (useEmulators) {
    if (path.includes("presign-upload")) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = data as any;
      return {
        url: "http://127.0.0.1:9199/fake-s3-post",
        fields: { key: `groups/${payload.groupId}/receipts/${payload.receiptId}/v1/${payload.fileName}` },
        objectKey: `groups/${payload.groupId}/receipts/${payload.receiptId}/v1/${payload.fileName}`
      } as unknown as TOutput;
    }
    if (path.includes("presign-download")) {
      return {
        downloadUrl: "http://127.0.0.1:9199/fake-s3-download"
      } as unknown as TOutput;
    }

    const funcName = mapPathToFunction(path);
    if (funcName) {
      let token: string;
      const isTest = typeof process !== "undefined" && process.env.NODE_ENV === "test";
      if (!isTest) {
        const user = auth.currentUser;
        token = user ? await user.getIdToken() : "mock-token";
      } else {
        token = (auth as unknown as { mockToken?: string }).mockToken || "mock-token";
      }

      const response = await fetch(`http://127.0.0.1:5001/mock-project-id/us-central1/${funcName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ data }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        if (errBody && errBody.error) {
          const error = new Error(errBody.error.message || "Emulator API error") as ApiError;
          error.code = errBody.error.status || "unknown";
          error.details = errBody.error.details || null;
          throw error;
        }
        const errText = await response.text().catch(() => "Unknown error");
        throw new Error(`Emulator function failed: ${response.status} ${errText}`);
      }

      const resBody = await response.json();
      return resBody.result;
    }
  }

  const isTest = typeof process !== "undefined" && process.env.NODE_ENV === "test";
  
  let token: string;
  if (!isTest) {
    const user = auth.currentUser;
    if (!user) {
      const error = new Error("unauthenticated") as ApiError;
      error.code = "unauthenticated";
      throw error;
    }
    token = await user.getIdToken();
  } else {
    // In tests, use a mock token or let the test override it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock auth object is used only during unit testing
    token = (auth as any).mockToken || "mock-token";
  }

  const win = typeof window !== "undefined" ? (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { CapacitorHttp?: { post: (options: { url: string; headers: Record<string, string>; data: unknown }) => Promise<{ status: number; data: unknown }> } } } }) : undefined;
  const isNative = typeof win?.Capacitor?.isNativePlatform === "function" && win.Capacitor.isNativePlatform();

  if (isNative && win?.Capacitor?.Plugins?.CapacitorHttp) {
    const httpPlugin = win.Capacitor.Plugins.CapacitorHttp;
    const response = await httpPlugin.post({
      url: `${getBaseUrl()}${path}`,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      data,
    });

    if (response.status < 200 || response.status >= 300) {
      const errBody = (response.data as { message?: string; code?: string; details?: unknown }) || {};
      const error = new Error(errBody.message || "API request failed") as ApiError;
      error.code = errBody.code || "unknown";
      error.details = errBody.details || null;
      throw error;
    }

    return response.data as TOutput;
  }

  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const error = new Error(errBody.message || "API request failed") as ApiError;
    error.code = errBody.code || "unknown";
    error.details = errBody.details || null;
    throw error;
  }

  return response.json();
}

export const fairtabApi = {
  expenses: {
    create: (data: unknown) => postRequest<unknown, unknown>("/api/expenses/create", data),
    update: (data: unknown) => postRequest<unknown, unknown>("/api/expenses/update", data),
    void: (data: unknown) => postRequest<unknown, unknown>("/api/expenses/void", data),
  },
  settlements: {
    create: (data: unknown) => postRequest<unknown, unknown>("/api/settlements/create", data),
    approve: (data: unknown) => postRequest<unknown, unknown>("/api/settlements/approve", data),
    reject: (data: unknown) => postRequest<unknown, unknown>("/api/settlements/reject", data),
    cancel: (data: unknown) => postRequest<unknown, unknown>("/api/settlements/cancel", data),
    void: (data: unknown) => postRequest<unknown, unknown>("/api/settlements/void", data),
    settleSplit: (data: unknown) => postRequest<unknown, unknown>("/api/settlements/settle-split", data),
    unsettleSplit: (data: unknown) => postRequest<unknown, unknown>("/api/settlements/unsettle-split", data),
  },
  budgets: {
    create: (data: unknown) => postRequest<unknown, unknown>("/api/budgets/create", data),
    update: (data: unknown) => postRequest<unknown, unknown>("/api/budgets/update", data),
    delete: (data: unknown) => postRequest<unknown, unknown>("/api/budgets/delete", data),
  },
  recurring: {
    createTemplate: (data: unknown) => postRequest<unknown, unknown>("/api/recurring/create-template", data),
    updateTemplate: (data: unknown) => postRequest<unknown, unknown>("/api/recurring/update-template", data),
    generateDrafts: (data: unknown) => postRequest<unknown, unknown>("/api/recurring/generate-drafts", data),
    approveDraft: (data: unknown) => postRequest<unknown, unknown>("/api/recurring/approve-draft", data),
    skipOccurrence: (data: unknown) => postRequest<unknown, unknown>("/api/recurring/skip-occurrence", data),
  },
  receipts: {
    create: (data: unknown) => postRequest<unknown, unknown>("/api/receipts/create", data),
    processOcr: (data: unknown) => postRequest<unknown, unknown>("/api/receipts/process-ocr", data),
    presignUpload: (data: unknown) => postRequest<unknown, unknown>("/api/receipts/presign-upload", data),
    presignDownload: (data: unknown) => postRequest<unknown, unknown>("/api/receipts/presign-download", data),
  },
  groups: {
    delete: (data: unknown) => postRequest<unknown, unknown>("/api/groups/delete", data),
    transferOwnership: (data: unknown) => postRequest<unknown, unknown>("/api/groups/transfer-ownership", data),
  },
  accounts: {
    delete: (data: unknown) => postRequest<unknown, unknown>("/api/accounts/delete", data),
    updateProfile: (data: unknown) => postRequest<unknown, unknown>("/api/accounts/update-profile", data),
    repairProfile: (data?: unknown) => postRequest<unknown, unknown>("/api/accounts/repair-profile", data || {}),
  },
  invitations: {
    createEmail: (data: unknown) => postRequest<unknown, unknown>("/api/invitations/create-email", data),
    acceptEmail: (data: unknown) => postRequest<unknown, unknown>("/api/invitations/accept-email", data),
    createGlobal: (data: unknown) => postRequest<unknown, unknown>("/api/invitations/create-global", data),
    revokeGlobal: (data: unknown) => postRequest<unknown, unknown>("/api/invitations/revoke-global", data),
    requestJoinGlobal: (data: unknown) => postRequest<unknown, unknown>("/api/invitations/request-join-global", data),
    approveJoinRequest: (data: unknown) => postRequest<unknown, unknown>("/api/invitations/approve-join-request", data),
    declineJoinRequest: (data: unknown) => postRequest<unknown, unknown>("/api/invitations/decline-join-request", data),
    resolveInviteToken: (data: unknown) => postRequest<unknown, unknown>("/api/invitations/resolve-token", data),
  },
};
