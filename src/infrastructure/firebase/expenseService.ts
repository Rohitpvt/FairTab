import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import type { ExpenseDocument, ExpenseRevision } from "@fairtab/domain";

export const expenseService = {
  /**
   * Watch all expenses in a group
   */
  watchExpenses(
    groupId: string,
    callback: (expenses: ExpenseDocument[], fromCache: boolean, hasPendingWrites: boolean) => void
  ) {
    const q = query(
      collection(db, `groups/${groupId}/expenses`),
      orderBy("incurredAt", "desc")
    );

    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        const expenses: ExpenseDocument[] = [];
        snapshot.forEach((d) => {
          expenses.push(d.data() as ExpenseDocument);
        });
        callback(
          expenses,
          snapshot.metadata.fromCache,
          snapshot.metadata.hasPendingWrites
        );
      },
      (error) => {
        console.error(`Failed to watch expenses for group ${groupId}:`, error);
      }
    );
  },

  /**
   * Watch a single expense document
   */
  watchExpense(
    groupId: string,
    expenseId: string,
    callback: (expense: ExpenseDocument | null, fromCache: boolean, hasPendingWrites: boolean) => void
  ) {
    return onSnapshot(
      doc(db, `groups/${groupId}/expenses`, expenseId),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!snapshot.exists()) {
          callback(null, false, false);
          return;
        }
        callback(
          snapshot.data() as ExpenseDocument,
          snapshot.metadata.fromCache,
          snapshot.metadata.hasPendingWrites
        );
      },
      (error) => {
        console.error(`Failed to watch expense ${expenseId}:`, error);
      }
    );
  },

  /**
   * Get a single expense document (once)
   */
  async getExpense(groupId: string, expenseId: string): Promise<ExpenseDocument | null> {
    const snap = await getDoc(doc(db, `groups/${groupId}/expenses`, expenseId));
    if (!snap.exists()) return null;
    return snap.data() as ExpenseDocument;
  },

  /**
   * Watch revisions of an expense
   */
  watchRevisions(
    groupId: string,
    expenseId: string,
    callback: (revisions: ExpenseRevision[]) => void
  ) {
    const q = query(
      collection(db, `groups/${groupId}/expenses/${expenseId}/revisions`),
      orderBy("version", "desc")
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const revisions: ExpenseRevision[] = [];
        snapshot.forEach((d) => {
          revisions.push(d.data() as ExpenseRevision);
        });
        callback(revisions);
      },
      (error) => {
        console.error(`Failed to watch revisions for expense ${expenseId}:`, error);
      }
    );
  },
};
