import { auth } from "../firebase/firebase";

const getBaseUrl = (): string => {
  let url = import.meta.env.VITE_API_BASE_URL || "";
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

const mapPathToFunction = (path: string): string => {
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  const parts = cleanPath.split("/");
  if (parts[0] === "api") {
    const category = parts[1];
    const action = parts[2];
    
    if (category === "expenses") {
      if (action === "create") return "createExpense";
      if (action === "update") return "updateExpense";
      if (action === "void") return "voidExpense";
    }
    if (category === "settlements") {
      if (action === "create") return "createSettlement";
      if (action === "void") return "voidSettlement";
    }
    if (category === "budgets") {
      if (action === "create") return "createBudget";
      if (action === "update") return "updateBudget";
      if (action === "delete") return "deleteBudget";
    }
    if (category === "recurring") {
      if (action === "create-template") return "createRecurringTemplate";
      if (action === "update-template") return "updateRecurringTemplate";
      if (action === "generate-drafts") return "generateRecurringDrafts";
      if (action === "approve-draft") return "approveRecurringDraft";
      if (action === "skip-occurrence") return "skipRecurringOccurrence";
    }
    if (category === "receipts") {
      if (action === "create") return "createReceipt";
      if (action === "process-ocr") return "processReceiptOCR";
    }
    if (category === "groups" && action === "delete") return "deleteGroup";
    if (category === "accounts") {
      if (action === "delete") return "deleteAccount";
      if (action === "update-profile") return "updateProfile";
      if (action === "repair-profile") return "repairProfile";
    }
    if (category === "invitations") {
      if (action === "create-email") return "createEmailInvitation";
      if (action === "accept-email") return "acceptEmailInvitation";
      if (action === "create-global") return "createGlobalInviteLink";
      if (action === "revoke-global") return "revokeGlobalInviteLink";
      if (action === "request-join-global") return "requestJoinViaGlobalLink";
      if (action === "approve-join-request") return "approveJoinRequest";
      if (action === "decline-join-request") return "declineJoinRequest";
    }
  }
  return "";
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
    void: (data: unknown) => postRequest<unknown, unknown>("/api/settlements/void", data),
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
