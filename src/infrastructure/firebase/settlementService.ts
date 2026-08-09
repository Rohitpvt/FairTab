import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import type { SettlementDocument, SettlementRevision } from "@fairtab/domain";

export const settlementService = {
  /**
   * Watch all settlements in a group
   */
  watchSettlements(
    groupId: string,
    callback: (settlements: SettlementDocument[], fromCache: boolean, hasPendingWrites: boolean) => void
  ) {
    const q = query(
      collection(db, `groups/${groupId}/settlements`),
      orderBy("createdAt", "desc")
    );

    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        const settlements: SettlementDocument[] = [];
        snapshot.forEach((d) => {
          settlements.push(d.data() as SettlementDocument);
        });
        callback(
          settlements,
          snapshot.metadata.fromCache,
          snapshot.metadata.hasPendingWrites
        );
      },
      (error) => {
        console.error(`Failed to watch settlements for group ${groupId}:`, error);
      }
    );
  },

  /**
   * Watch a single settlement document
   */
  watchSettlement(
    groupId: string,
    settlementId: string,
    callback: (settlement: SettlementDocument | null, fromCache: boolean, hasPendingWrites: boolean) => void
  ) {
    return onSnapshot(
      doc(db, `groups/${groupId}/settlements`, settlementId),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!snapshot.exists()) {
          callback(null, false, false);
          return;
        }
        callback(
          snapshot.data() as SettlementDocument,
          snapshot.metadata.fromCache,
          snapshot.metadata.hasPendingWrites
        );
      },
      (error) => {
        console.error(`Failed to watch settlement ${settlementId}:`, error);
      }
    );
  },

  /**
   * Get a single settlement document (once)
   */
  async getSettlement(groupId: string, settlementId: string): Promise<SettlementDocument | null> {
    const snap = await getDoc(doc(db, `groups/${groupId}/settlements`, settlementId));
    if (!snap.exists()) return null;
    return snap.data() as SettlementDocument;
  },

  /**
   * Watch revisions of a settlement
   */
  watchRevisions(
    groupId: string,
    settlementId: string,
    callback: (revisions: SettlementRevision[]) => void
  ) {
    const q = query(
      collection(db, `groups/${groupId}/settlements/${settlementId}/revisions`),
      orderBy("version", "desc")
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const revisions: SettlementRevision[] = [];
        snapshot.forEach((d) => {
          revisions.push(d.data() as SettlementRevision);
        });
        callback(revisions);
      },
      (error) => {
        console.error(`Failed to watch revisions for settlement ${settlementId}:`, error);
      }
    );
  },
};
