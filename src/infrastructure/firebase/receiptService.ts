import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import type { ReceiptDocument, ReceiptRevision } from "@fairtab/domain";

export const receiptService = {
  /**
   * Watch all receipts in a group
   */
  watchReceipts(
    groupId: string,
    callback: (receipts: ReceiptDocument[], fromCache: boolean, hasPendingWrites: boolean) => void
  ) {
    const q = query(
      collection(db, `groups/${groupId}/receipts`),
      orderBy("createdAt", "desc")
    );

    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        const receipts: ReceiptDocument[] = [];
        snapshot.forEach((d) => {
          receipts.push(d.data() as ReceiptDocument);
        });
        callback(
          receipts,
          snapshot.metadata.fromCache,
          snapshot.metadata.hasPendingWrites
        );
      },
      (error) => {
        console.error(`Failed to watch receipts for group ${groupId}:`, error);
      }
    );
  },

  /**
   * Watch a single receipt document
   */
  watchReceipt(
    groupId: string,
    receiptId: string,
    callback: (receipt: ReceiptDocument | null, fromCache: boolean, hasPendingWrites: boolean) => void
  ) {
    return onSnapshot(
      doc(db, `groups/${groupId}/receipts`, receiptId),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!snapshot.exists()) {
          callback(null, false, false);
          return;
        }
        callback(
          snapshot.data() as ReceiptDocument,
          snapshot.metadata.fromCache,
          snapshot.metadata.hasPendingWrites
        );
      },
      (error) => {
        console.error(`Failed to watch receipt ${receiptId}:`, error);
      }
    );
  },

  /**
   * Get a single receipt document (once)
   */
  async getReceipt(groupId: string, receiptId: string): Promise<ReceiptDocument | null> {
    const snap = await getDoc(doc(db, `groups/${groupId}/receipts`, receiptId));
    if (!snap.exists()) return null;
    return snap.data() as ReceiptDocument;
  },

  /**
   * Watch revisions of a receipt
   */
  watchRevisions(
    groupId: string,
    receiptId: string,
    callback: (revisions: ReceiptRevision[]) => void
  ) {
    const q = query(
      collection(db, `groups/${groupId}/receipts/${receiptId}/revisions`),
      orderBy("version", "desc")
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const revisions: ReceiptRevision[] = [];
        snapshot.forEach((d) => {
          revisions.push(d.data() as ReceiptRevision);
        });
        callback(revisions);
      },
      (error) => {
        console.error(`Failed to watch revisions for receipt ${receiptId}:`, error);
      }
    );
  },

  async createReceipt(data: unknown): Promise<unknown> {
    const { fairtabApi } = await import("../api/fairtabApi");
    return fairtabApi.receipts.create(data);
  },

  async processReceiptOCR(data: unknown): Promise<unknown> {
    const { fairtabApi } = await import("../api/fairtabApi");
    return fairtabApi.receipts.processOcr(data);
  },

  async presignUpload(data: unknown): Promise<unknown> {
    const { fairtabApi } = await import("../api/fairtabApi");
    return fairtabApi.receipts.presignUpload(data);
  },

  async presignDownload(data: unknown): Promise<unknown> {
    const { fairtabApi } = await import("../api/fairtabApi");
    return fairtabApi.receipts.presignDownload(data);
  },
};
