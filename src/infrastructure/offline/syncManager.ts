/* eslint-disable @typescript-eslint/no-explicit-any */
import { offlineDb, purgeUserOfflineData } from "./db";
import type { OutboxOperation, OutboxAttempt } from "./db";
import { auth, functions } from "../firebase/firebase";
import { httpsCallable } from "firebase/functions";
import { receiptStorage } from "../storage/receiptStorage";

export type SyncStatusListener = (status: {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
}) => void;

class ForegroundSyncManager {
  private listeners: Set<SyncStatusListener> = new Set();
  private isOnlineState: boolean = typeof navigator !== "undefined" ? navigator.onLine : true;
  private isSyncingState: boolean = false;
  private syncTimeout: NodeJS.Timeout | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.handleConnectionChange(true));
      window.addEventListener("offline", () => this.handleConnectionChange(false));
    }
  }

  public get isOnline(): boolean {
    return this.isOnlineState;
  }

  public get isSyncing(): boolean {
    return this.isSyncingState;
  }

  public registerListener(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);
    this.notifyListeners();
    return () => {
      this.listeners.delete(listener);
    };
  }

  private handleConnectionChange(online: boolean) {
    this.isOnlineState = online;
    this.notifyListeners();
    if (online) {
      this.triggerSync();
    }
  }

  private async notifyListeners() {
    try {
      const currentUid = auth.currentUser?.uid || "anonymous";
      const pendingCount = await offlineDb.expenseOutbox
        .where("status")
        .anyOf("pending", "processing")
        .filter((op) => op.uid === currentUid)
        .count();
      const failedCount = await offlineDb.expenseOutbox
        .where("status")
        .equals("failed")
        .filter((op) => op.uid === currentUid)
        .count();

      const pendingReceipts = await offlineDb.receiptDrafts
        .where("status")
        .anyOf("queued", "uploading")
        .filter((d) => d.uid === currentUid)
        .count();
      const failedReceipts = await offlineDb.receiptDrafts
        .where("status")
        .equals("failed")
        .filter((d) => d.uid === currentUid)
        .count();

      this.listeners.forEach((listener) => {
        listener({
          isOnline: this.isOnlineState,
          isSyncing: this.isSyncingState,
          pendingCount: pendingCount + pendingReceipts,
          failedCount: failedCount + failedReceipts,
        });
      });
    } catch (e) {
      console.error("Failed to notify sync listeners", e);
    }
  }

  /**
   * Add a create expense operation to the outbox queue
   */
  public async queueCreateExpense(groupId: string, payload: any): Promise<string> {
    const clientOperationId = payload.clientOperationId;
    const currentUid = auth.currentUser?.uid || "anonymous";
    const op: OutboxOperation = {
      clientOperationId,
      groupId,
      uid: currentUid,
      type: "create",
      payload,
      status: "pending",
      createdAt: Date.now(),
      attempts: 0,
    };

    await offlineDb.expenseOutbox.put(op);
    this.notifyListeners();
    this.triggerSync();
    return clientOperationId;
  }

  /**
   * Add an update expense operation to the outbox queue
   */
  public async queueUpdateExpense(groupId: string, payload: any): Promise<string> {
    const clientOperationId = payload.clientOperationId;
    const currentUid = auth.currentUser?.uid || "anonymous";
    const op: OutboxOperation = {
      clientOperationId,
      groupId,
      uid: currentUid,
      type: "update",
      payload,
      status: "pending",
      createdAt: Date.now(),
      attempts: 0,
    };

    await offlineDb.expenseOutbox.put(op);
    this.notifyListeners();
    this.triggerSync();
    return clientOperationId;
  }

  /**
   * Add a void expense operation to the outbox queue
   */
  public async queueVoidExpense(groupId: string, payload: any): Promise<string> {
    const clientOperationId = payload.clientOperationId;
    const currentUid = auth.currentUser?.uid || "anonymous";
    const op: OutboxOperation = {
      clientOperationId,
      groupId,
      uid: currentUid,
      type: "void",
      payload,
      status: "pending",
      createdAt: Date.now(),
      attempts: 0,
    };

    await offlineDb.expenseOutbox.put(op);
    this.notifyListeners();
    this.triggerSync();
    return clientOperationId;
  }

  /**
   * Add a create settlement operation to the outbox queue
   */
  public async queueCreateSettlement(groupId: string, payload: any): Promise<string> {
    const clientOperationId = payload.clientOperationId;
    const currentUid = auth.currentUser?.uid || "anonymous";
    const op: OutboxOperation = {
      clientOperationId,
      groupId,
      uid: currentUid,
      type: "create_settlement",
      payload,
      status: "pending",
      createdAt: Date.now(),
      attempts: 0,
    };

    await offlineDb.expenseOutbox.put(op);
    this.notifyListeners();
    this.triggerSync();
    return clientOperationId;
  }

  /**
   * Add a void settlement operation to the outbox queue
   */
  public async queueVoidSettlement(groupId: string, payload: any): Promise<string> {
    const clientOperationId = payload.clientOperationId;
    const currentUid = auth.currentUser?.uid || "anonymous";
    const op: OutboxOperation = {
      clientOperationId,
      groupId,
      uid: currentUid,
      type: "void_settlement",
      payload,
      status: "pending",
      createdAt: Date.now(),
      attempts: 0,
    };

    await offlineDb.expenseOutbox.put(op);
    this.notifyListeners();
    this.triggerSync();
    return clientOperationId;
  }

  /**
   * Trigger the foreground synchronization run
   */
  public triggerSync() {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    this.syncTimeout = setTimeout(() => {
      this.syncTimeout = null;
      if (this.isOnlineState && !this.isSyncingState) {
        this.processOutboxQueue();
      }
    }, 100); // Debounce trigger by 100ms
  }

  /**
   * Processes the outbox queue using Web Locks API to prevent multiple tab contention
   */
  private async processOutboxQueue() {
    if (!navigator.locks) {
      // Fallback if browser doesn't support Web Locks (rare in modern browsers)
      await this.runSyncLoop();
      return;
    }

    try {
      await navigator.locks.request("fairtab:outbox-sync", async () => {
        await this.runSyncLoop();
      });
    } catch (err) {
      console.error("Failed to acquire Web Lock for outbox sync", err);
    }
  }

  private async runSyncLoop() {
    this.isSyncingState = true;
    this.notifyListeners();

    try {
      // Sync offline receipt uploads first
      await this.syncReceiptDrafts();

      let runAgain = true;
      while (runAgain && this.isOnlineState) {
        // Fetch operations in pending or failed state (that are not in backoff delay) for the current user
        const currentUid = auth.currentUser?.uid || "anonymous";
        const ops = await offlineDb.expenseOutbox
          .where("uid")
          .equals(currentUid)
          .toArray();
        
        // Sort chronologically by createdAt to guarantee execution ordering
        ops.sort((a, b) => a.createdAt - b.createdAt);

        const eligibleOps = ops.filter((op) => {
          if (op.status === "processing") return false;
          if (op.status === "failed" && op.attempts >= 10) return false; // Max transient retries capped
          
          // Exponential backoff check
          if (op.lastAttemptAt && op.attempts > 0) {
            const delay = Math.min(30000, 1000 * Math.pow(2, op.attempts)); // capped at 30s
            if (Date.now() - op.lastAttemptAt < delay) {
              return false; // still in backoff period
            }
          }
          return true;
        });

        if (eligibleOps.length === 0) {
          runAgain = false;
          break;
        }

        // Process the first eligible operation
        const op = eligibleOps[0];
        await this.syncOperation(op);
      }
    } finally {
      this.isSyncingState = false;
      this.notifyListeners();
    }
  }

  private async syncOperation(op: OutboxOperation) {
    // Set status to processing
    await offlineDb.expenseOutbox.update(op.clientOperationId, { status: "processing" });
    this.notifyListeners();

    const callableName =
      op.type === "create"
        ? "createExpense"
        : op.type === "update"
        ? "updateExpense"
        : op.type === "void"
        ? "voidExpense"
        : op.type === "create_settlement"
        ? "createSettlement"
        : op.type === "void_settlement"
        ? "voidSettlement"
        : op.type === "create_recurring_template"
        ? "createRecurringTemplate"
        : op.type === "update_recurring_template"
        ? "updateRecurringTemplate"
        : op.type === "approve_recurring_draft"
        ? "approveRecurringDraft"
        : op.type === "skip_recurring_draft"
        ? "skipRecurringOccurrence"
        : op.type === "create_budget"
        ? "createBudget"
        : op.type === "update_budget"
        ? "updateBudget"
        : op.type === "delete_budget"
        ? "deleteBudget"
        : "skipRecurringOccurrence";
    const callableFn = httpsCallable<any, any>(functions, callableName);

    try {
      await callableFn(op.payload);

      // Success! Remove from outbox queue
      await offlineDb.expenseOutbox.delete(op.clientOperationId);

      // Log successful attempt
      const attempt: OutboxAttempt = {
        clientOperationId: op.clientOperationId,
        attemptedAt: Date.now(),
        status: "success",
      };
      await offlineDb.outboxAttempts.add(attempt);

    } catch (err: any) {
      console.error(`Sync failed for operation ${op.clientOperationId}:`, err);

      const isPermanentError = this.checkIfPermanentError(err);

      const updatedAttempts = op.attempts + 1;
      const errorMessage = err.message || String(err);
      const errorDetails = err.details || null;

      if (isPermanentError) {
        // Permanent failure: mark status as "failed", do not retry
        await offlineDb.expenseOutbox.update(op.clientOperationId, {
          status: "failed",
          attempts: updatedAttempts,
          lastAttemptAt: Date.now(),
          errorMessage,
          errorDetails,
        });
      } else {
        // Transient error (network issue): set status back to pending, increment attempts for backoff
        await offlineDb.expenseOutbox.update(op.clientOperationId, {
          status: "pending",
          attempts: updatedAttempts,
          lastAttemptAt: Date.now(),
          errorMessage,
        });
      }

      // Log failed attempt
      const attempt: OutboxAttempt = {
        clientOperationId: op.clientOperationId,
        attemptedAt: Date.now(),
        status: "failure",
        errorMessage,
      };
      await offlineDb.outboxAttempts.add(attempt);
    }
  }

  /**
   * Determine if an error code is permanent (won't resolve with retries)
   */
  private checkIfPermanentError(err: any): boolean {
    const code = err.code || "";
    // Permanent firebase callable errors:
    // permission-denied, invalid-argument, not-found, already-exists (if payload mismatch), failed-precondition, out-of-range, unauthenticated, aborted
    const permanentCodes = [
      "permission-denied",
      "invalid-argument",
      "not-found",
      "already-exists",
      "failed-precondition",
      "out-of-range",
      "unauthenticated",
      "aborted",
      "functions/permission-denied",
      "functions/invalid-argument",
      "functions/not-found",
      "functions/already-exists",
      "functions/failed-precondition",
      "functions/out-of-range",
      "functions/unauthenticated",
      "functions/aborted",
    ];

    return permanentCodes.includes(code);
  }

  /**
   * Add a receipt upload to the outbox queue
   */
  public async queueReceiptUpload(
    groupId: string,
    receiptId: string,
    fileName: string,
    fileType: string,
    fileBlob: Blob,
    ocrData?: any
  ): Promise<string> {
    const currentUid = auth.currentUser?.uid || "anonymous";
    await offlineDb.receiptDrafts.put({
      id: receiptId,
      groupId,
      uid: currentUid,
      fileName,
      fileType,
      fileBlob,
      status: "queued",
      createdAt: Date.now(),
      ocrMerchant: ocrData?.merchant,
      ocrDate: ocrData?.date,
      ocrCurrency: ocrData?.currency,
      ocrSubtotal: ocrData?.subtotal,
      ocrTax: ocrData?.tax,
      ocrTip: ocrData?.tip,
      ocrDiscount: ocrData?.discount,
      ocrTotal: ocrData?.total,
      ocrItems: ocrData?.items,
      ocrConfidence: ocrData?.confidence,
    });
    this.notifyListeners();
    this.triggerSync();
    return receiptId;
  }

  /**
   * Synchronize pending offline receipt uploads
   */
  private async syncReceiptDrafts() {
    if (!this.isOnlineState) return;

    // Use Web Locks to prevent duplicate processing of receipt drafts across tabs
    if (navigator.locks) {
      try {
        await navigator.locks.request("fairtab:receipt-sync", async () => {
          await this.runReceiptSyncLoop();
        });
      } catch (err) {
        console.error("Failed to acquire Web Lock for receipt sync", err);
      }
    } else {
      await this.runReceiptSyncLoop();
    }
  }

  private async runReceiptSyncLoop() {
    const currentUid = auth.currentUser?.uid || "anonymous";
    const drafts = await offlineDb.receiptDrafts
      .where("uid")
      .equals(currentUid)
      .filter((d) => d.status === "queued" || d.status === "failed")
      .toArray();

    for (const draft of drafts) {
      if (!this.isOnlineState) break;

      await offlineDb.receiptDrafts.update(draft.id, { status: "uploading" });
      this.notifyListeners();

      try {
        const version = 1;
        
        // Upload file blob using the S3 receiptStorage provider
        const meta = await receiptStorage.uploadReceipt(draft.groupId, draft.id, draft.fileBlob, draft.fileName, version);
        const storagePath = meta.objectKey;

        // Call the Cloud Function createReceipt to create authoritative record in Firestore
        const createReceiptFn = httpsCallable<any, any>(functions, "createReceipt");
        const clientOperationId = crypto.randomUUID();

        // Map cached OCR details if they exist
        const ocrResultPayload = draft.ocrMerchant ? {
          merchant: draft.ocrMerchant,
          date: draft.ocrDate || new Date().toISOString().split("T")[0],
          currency: draft.ocrCurrency || "USD",
          subtotal: draft.ocrSubtotal || 0,
          tax: draft.ocrTax || 0,
          tip: draft.ocrTip || 0,
          discount: draft.ocrDiscount || 0,
          total: draft.ocrTotal || 0,
          confidence: draft.ocrConfidence || {},
          items: (draft.ocrItems || []).map((it) => ({
            description: it.description,
            amountMinor: it.amountMinor,
            confidence: it.confidence,
            participantIds: it.participantIds || [],
          })),
        } : undefined;

        await createReceiptFn({
          clientOperationId,
          groupId: draft.groupId,
          receiptId: draft.id,
          fileName: draft.fileName,
          fileType: draft.fileType,
          storagePath,
          ocrResult: ocrResultPayload,
        });

        // Delete from local drafts on successful sync since it is now authoritative on the server
        await offlineDb.receiptDrafts.delete(draft.id);

      } catch (err: any) {
        console.error(`Receipt sync failed for draft ${draft.id}:`, err);
        await offlineDb.receiptDrafts.update(draft.id, {
          status: "failed",
          errorMessage: err.message || String(err),
        });
      } finally {
        this.notifyListeners();
      }
    }
  }

  /**
   * Purge user offline data on logout
   */
  public async purgeUserOfflineData(uid: string) {
    try {
      await purgeUserOfflineData(uid);
      this.notifyListeners();
    } catch (e) {
      console.error(`Failed to purge offline data for user ${uid}:`, e);
    }
  }

  /**
   * Add a create recurring template operation to the outbox queue
   */
  public async queueCreateRecurringTemplate(groupId: string, payload: any): Promise<string> {
    const clientOperationId = payload.clientOperationId;
    const currentUid = auth.currentUser?.uid || "anonymous";
    const op: OutboxOperation = {
      clientOperationId,
      groupId,
      uid: currentUid,
      type: "create_recurring_template",
      payload,
      status: "pending",
      createdAt: Date.now(),
      attempts: 0,
    };
    await offlineDb.expenseOutbox.put(op);
    this.notifyListeners();
    this.triggerSync();
    return clientOperationId;
  }

  /**
   * Add an update recurring template operation to the outbox queue
   */
  public async queueUpdateRecurringTemplate(groupId: string, payload: any): Promise<string> {
    const clientOperationId = payload.clientOperationId;
    const currentUid = auth.currentUser?.uid || "anonymous";
    const op: OutboxOperation = {
      clientOperationId,
      groupId,
      uid: currentUid,
      type: "update_recurring_template",
      payload,
      status: "pending",
      createdAt: Date.now(),
      attempts: 0,
    };
    await offlineDb.expenseOutbox.put(op);
    this.notifyListeners();
    this.triggerSync();
    return clientOperationId;
  }

  /**
   * Add an approve recurring draft operation to the outbox queue
   */
  public async queueApproveRecurringDraft(groupId: string, payload: any): Promise<string> {
    const clientOperationId = payload.clientOperationId;
    const currentUid = auth.currentUser?.uid || "anonymous";
    const op: OutboxOperation = {
      clientOperationId,
      groupId,
      uid: currentUid,
      type: "approve_recurring_draft",
      payload,
      status: "pending",
      createdAt: Date.now(),
      attempts: 0,
    };
    await offlineDb.expenseOutbox.put(op);
    this.notifyListeners();
    this.triggerSync();
    return clientOperationId;
  }

  /**
   * Add a skip recurring draft operation to the outbox queue
   */
  public async queueSkipRecurringDraft(groupId: string, payload: any): Promise<string> {
    const clientOperationId = payload.clientOperationId;
    const currentUid = auth.currentUser?.uid || "anonymous";
    const op: OutboxOperation = {
      clientOperationId,
      groupId,
      uid: currentUid,
      type: "skip_recurring_draft",
      payload,
      status: "pending",
      createdAt: Date.now(),
      attempts: 0,
    };
    await offlineDb.expenseOutbox.put(op);
    this.notifyListeners();
    this.triggerSync();
    return clientOperationId;
  }

  /**
   * Add a create budget operation to the outbox queue
   */
  public async queueCreateBudget(groupId: string, payload: any): Promise<string> {
    const clientOperationId = payload.clientOperationId;
    const currentUid = auth.currentUser?.uid || "anonymous";
    const op: OutboxOperation = {
      clientOperationId,
      groupId,
      uid: currentUid,
      type: "create_budget",
      payload,
      status: "pending",
      createdAt: Date.now(),
      attempts: 0,
    };
    await offlineDb.expenseOutbox.put(op);
    this.notifyListeners();
    this.triggerSync();
    return clientOperationId;
  }

  /**
   * Add an update budget operation to the outbox queue
   */
  public async queueUpdateBudget(groupId: string, payload: any): Promise<string> {
    const clientOperationId = payload.clientOperationId;
    const currentUid = auth.currentUser?.uid || "anonymous";
    const op: OutboxOperation = {
      clientOperationId,
      groupId,
      uid: currentUid,
      type: "update_budget",
      payload,
      status: "pending",
      createdAt: Date.now(),
      attempts: 0,
    };
    await offlineDb.expenseOutbox.put(op);
    this.notifyListeners();
    this.triggerSync();
    return clientOperationId;
  }

  /**
   * Add a delete budget operation to the outbox queue
   */
  public async queueDeleteBudget(groupId: string, payload: any): Promise<string> {
    const clientOperationId = payload.clientOperationId;
    const currentUid = auth.currentUser?.uid || "anonymous";
    const op: OutboxOperation = {
      clientOperationId,
      groupId,
      uid: currentUid,
      type: "delete_budget",
      payload,
      status: "pending",
      createdAt: Date.now(),
      attempts: 0,
    };
    await offlineDb.expenseOutbox.put(op);
    this.notifyListeners();
    this.triggerSync();
    return clientOperationId;
  }
}

export const syncManager = new ForegroundSyncManager();
