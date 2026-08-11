/* eslint-disable @typescript-eslint/no-explicit-any */
import "fake-indexeddb/auto";
import { describe, test, expect, beforeEach, vi, type Mock } from "vitest";
import { offlineDb, purgeUserOfflineData } from "../infrastructure/offline/db";
import { syncManager } from "../infrastructure/offline/syncManager";
import { fairtabApi } from "../infrastructure/api/fairtabApi";

// Mock fairtabApi
vi.mock("../infrastructure/api/fairtabApi", () => {
  return {
    fairtabApi: {
      expenses: {
        create: vi.fn(),
        update: vi.fn(),
        void: vi.fn(),
      },
      settlements: {
        create: vi.fn(),
        void: vi.fn(),
      },
      budgets: {
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      recurring: {
        createTemplate: vi.fn(),
        updateTemplate: vi.fn(),
        generateDrafts: vi.fn(),
        approveDraft: vi.fn(),
        skipOccurrence: vi.fn(),
      },
      accounts: {
        delete: vi.fn(),
      },
      receipts: {
        create: vi.fn(),
        presignUpload: vi.fn(),
        presignDownload: vi.fn(),
        processOcr: vi.fn(),
      }
    }
  };
});

describe("Foreground Sync Manager Unit Tests", () => {
  beforeEach(async () => {
    // Clear IndexedDB stores
    await offlineDb.expenseOutbox.clear();
    await offlineDb.outboxAttempts.clear();
    await offlineDb.expenseDrafts.clear();
    
    vi.restoreAllMocks();
  });

  test("queueCreateExpense enqueues operation and runs sync successfully", async () => {
    const mockCall = vi.fn().mockResolvedValue({ expenseId: "exp-1", version: 1 });
    (fairtabApi.expenses.create as Mock).mockImplementation(mockCall);

    const payload = {
      clientOperationId: "op-create-test",
      expenseId: "exp-1",
      title: "Pizza Night",
      amountMinor: 2500,
    };

    // Queue operation
    const opId = await syncManager.queueCreateExpense("group-1", payload);
    expect(opId).toBe("op-create-test");

    // Verify it exists in IndexedDB with pending status
    const op = await offlineDb.expenseOutbox.get(opId);
    expect(op).toBeDefined();
    expect(op?.status).toBe("pending");
    expect(op?.type).toBe("create");

    // Run sync manager trigger
    syncManager.triggerSync();

    // Wait short time for async tasks to process
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Verify operation is removed from the queue
    const opAfter = await offlineDb.expenseOutbox.get(opId);
    expect(opAfter).toBeUndefined();

    // Verify successful attempt was logged
    const attempts = await offlineDb.outboxAttempts.toArray();
    expect(attempts.length).toBe(1);
    expect(attempts[0].clientOperationId).toBe(opId);
    expect(attempts[0].status).toBe("success");
    expect(mockCall).toHaveBeenCalledTimes(1);
  });

  test("handling transient network errors retries with incremented attempts", async () => {
    // Mock api call throwing transient network error
    const transientError = new Error("Network timeout");
    (transientError as any).code = "unavailable"; // transient code
    const mockCall = vi.fn().mockRejectedValue(transientError);
    (fairtabApi.expenses.create as Mock).mockImplementation(mockCall);

    const payload = {
      clientOperationId: "op-transient-test",
      expenseId: "exp-2",
      title: "Uber Ride",
      amountMinor: 1200,
    };

    await syncManager.queueCreateExpense("group-1", payload);
    syncManager.triggerSync();

    await new Promise((resolve) => setTimeout(resolve, 300));

    // Operation remains in queue with status set back to pending and attempts = 1
    const op = await offlineDb.expenseOutbox.get("op-transient-test");
    expect(op).toBeDefined();
    expect(op?.status).toBe("pending");
    expect(op?.attempts).toBe(1);
    expect(op?.errorMessage).toContain("Network timeout");

    // Failure attempt logged
    const attempts = await offlineDb.outboxAttempts.toArray();
    expect(attempts.length).toBe(1);
    expect(attempts[0].status).toBe("failure");
    expect(attempts[0].errorMessage).toContain("Network timeout");
  });

  test("handling permanent validation errors marks operation as failed", async () => {
    // Mock api call throwing permanent validation error
    const permanentError = new Error("Invalid splits sum");
    (permanentError as any).code = "invalid-argument"; // permanent code
    const mockCall = vi.fn().mockRejectedValue(permanentError);
    (fairtabApi.expenses.create as Mock).mockImplementation(mockCall);

    const payload = {
      clientOperationId: "op-perm-test",
      expenseId: "exp-3",
      title: "Invalid Split",
      amountMinor: 1500,
    };

    await syncManager.queueCreateExpense("group-1", payload);
    syncManager.triggerSync();

    await new Promise((resolve) => setTimeout(resolve, 300));

    // Operation is marked as failed, attempts = 1
    const op = await offlineDb.expenseOutbox.get("op-perm-test");
    expect(op).toBeDefined();
    expect(op?.status).toBe("failed");
    expect(op?.attempts).toBe(1);
    expect(op?.errorMessage).toContain("Invalid splits sum");

    // Failure attempt logged
    const attempts = await offlineDb.outboxAttempts.toArray();
    expect(attempts.length).toBe(1);
    expect(attempts[0].status).toBe("failure");
  });

  describe("User-Scoped Local Cache Purge Tests (Phase 10)", () => {

    beforeEach(async () => {
      await Promise.all([
        offlineDb.expenseDrafts.clear(),
        offlineDb.expenseOutbox.clear(),
        offlineDb.outboxAttempts.clear(),
        offlineDb.settlementDrafts.clear(),
        offlineDb.receiptDrafts.clear(),
        offlineDb.budgetDrafts.clear(),
        offlineDb.smartInsights.clear()
      ]);
    });

    test("purgeUserOfflineData(uid) clears target user data and attempts but preserves other users data", async () => {
      const userA = "alice-uid";
      const userB = "bob-uid";

      // 1. Populate data for Alice (User A)
      await offlineDb.expenseDrafts.put({ id: "draft-a1", groupId: "g1", uid: userA, title: "Alice Draft", amountMinor: 100, category: "food", incurredAtSeconds: 0, currency: "USD", fxNumerator: 1, fxDenominator: 1, splitMethod: "equal", payers: [], splits: [], updatedAt: Date.now() } as any);
      await offlineDb.expenseOutbox.put({ clientOperationId: "op-a1", groupId: "g1", uid: userA, type: "create", payload: {}, status: "pending", createdAt: Date.now(), attempts: 0 });
      await offlineDb.outboxAttempts.put({ id: 1, clientOperationId: "op-a1", status: "failure", errorMessage: "Transient error", attemptedAt: Date.now() });

      // 2. Populate data for Bob (User B)
      await offlineDb.expenseDrafts.put({ id: "draft-b1", groupId: "g1", uid: userB, title: "Bob Draft", amountMinor: 200, category: "food", incurredAtSeconds: 0, currency: "USD", fxNumerator: 1, fxDenominator: 1, splitMethod: "equal", payers: [], splits: [], updatedAt: Date.now() } as any);
      await offlineDb.expenseOutbox.put({ clientOperationId: "op-b1", groupId: "g1", uid: userB, type: "create", payload: {}, status: "pending", createdAt: Date.now(), attempts: 0 });
      await offlineDb.outboxAttempts.put({ id: 2, clientOperationId: "op-b1", status: "failure", errorMessage: "Transient error", attemptedAt: Date.now() });

      // 3. Purge Alice's data
      await purgeUserOfflineData(userA);

      // 4. Assertions
      const aliceDrafts = await offlineDb.expenseDrafts.where("uid").equals(userA).toArray();
      const bobDrafts = await offlineDb.expenseDrafts.where("uid").equals(userB).toArray();
      expect(aliceDrafts.length).toBe(0);
      expect(bobDrafts.length).toBe(1);
      expect(bobDrafts[0].title).toBe("Bob Draft");

      const aliceOps = await offlineDb.expenseOutbox.where("uid").equals(userA).toArray();
      const bobOps = await offlineDb.expenseOutbox.where("uid").equals(userB).toArray();
      expect(aliceOps.length).toBe(0);
      expect(bobOps.length).toBe(1);

      const aliceAttempts = await offlineDb.outboxAttempts.where("clientOperationId").equals("op-a1").toArray();
      const bobAttempts = await offlineDb.outboxAttempts.where("clientOperationId").equals("op-b1").toArray();
      expect(aliceAttempts.length).toBe(0);
      expect(bobAttempts.length).toBe(1);
    });
  });
});
