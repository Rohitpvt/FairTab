import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import type { BudgetDocument } from "@fairtab/domain";

export const budgetService = {
  /**
   * Watch all active (non-deleted) budgets in a group.
   */
  watchBudgets(
    groupId: string,
    callback: (budgets: BudgetDocument[], fromCache: boolean, hasPendingWrites: boolean) => void
  ) {
    const q = query(
      collection(db, `groups/${groupId}/budgets`),
      where("status", "in", ["active", "paused"]),
      orderBy("createdAt", "desc")
    );

    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        const budgets: BudgetDocument[] = [];
        snapshot.forEach((d) => {
          budgets.push(d.data() as BudgetDocument);
        });
        callback(
          budgets,
          snapshot.metadata.fromCache,
          snapshot.metadata.hasPendingWrites
        );
      },
      (error) => {
        console.error(`Failed to watch budgets for group ${groupId}:`, error);
      }
    );
  },

  /**
   * Watch all budgets including deleted (for audit/history).
   */
  watchAllBudgets(
    groupId: string,
    callback: (budgets: BudgetDocument[], fromCache: boolean) => void
  ) {
    const q = query(
      collection(db, `groups/${groupId}/budgets`),
      orderBy("createdAt", "desc")
    );

    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        const budgets: BudgetDocument[] = [];
        snapshot.forEach((d) => {
          budgets.push(d.data() as BudgetDocument);
        });
        callback(budgets, snapshot.metadata.fromCache);
      },
      (error) => {
        console.error(`Failed to watch all budgets for group ${groupId}:`, error);
      }
    );
  },

  async createBudget(data: unknown): Promise<unknown> {
    const { fairtabApi } = await import("../api/fairtabApi");
    return fairtabApi.budgets.create(data);
  },

  async updateBudget(data: unknown): Promise<unknown> {
    const { fairtabApi } = await import("../api/fairtabApi");
    return fairtabApi.budgets.update(data);
  },

  async deleteBudget(data: unknown): Promise<unknown> {
    const { fairtabApi } = await import("../api/fairtabApi");
    return fairtabApi.budgets.delete(data);
  },
};
