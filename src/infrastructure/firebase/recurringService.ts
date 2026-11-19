import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import type { RecurringTemplateDocument, RecurringOccurrenceDocument } from "@fairtab/domain";

export const recurringService = {
  /**
   * Watch all recurring templates in a group
   */
  watchTemplates(
    groupId: string,
    callback: (templates: RecurringTemplateDocument[], fromCache: boolean) => void
  ) {
    const q = query(
      collection(db, `groups/${groupId}/recurringTemplates`),
      orderBy("createdAt", "desc")
    );

    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        const templates: RecurringTemplateDocument[] = [];
        snapshot.forEach((d) => {
          templates.push(d.data() as RecurringTemplateDocument);
        });
        callback(templates, snapshot.metadata.fromCache);
      },
      (error) => {
        console.error(`Failed to watch templates for group ${groupId}:`, error);
      }
    );
  },

  /**
   * Watch all pending occurrence drafts for a list of templates
   */
  watchAllPendingOccurrences(
    groupId: string,
    templates: RecurringTemplateDocument[],
    callback: (occurrences: RecurringOccurrenceDocument[]) => void
  ) {
    if (templates.length === 0) {
      callback([]);
      return () => {};
    }

    const occurrencesMap = new Map<string, RecurringOccurrenceDocument[]>();
    const unsubscribes: (() => void)[] = [];

    const triggerCallback = () => {
      const all: RecurringOccurrenceDocument[] = [];
      occurrencesMap.forEach((list) => {
        all.push(...list);
      });
      // Sort by occurrence date (oldest first)
      all.sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate));
      callback(all);
    };

    templates.forEach((temp) => {
      const q = query(
        collection(db, `groups/${groupId}/recurringTemplates/${temp.id}/occurrences`),
        where("status", "==", "pending")
      );

      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const list: RecurringOccurrenceDocument[] = [];
          snapshot.forEach((d) => {
            list.push(d.data() as RecurringOccurrenceDocument);
          });
          occurrencesMap.set(temp.id, list);
          triggerCallback();
        },
        (error) => {
          console.error(`Failed to watch occurrences for template ${temp.id}:`, error);
        }
      );
      unsubscribes.push(unsub);
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  },

  /**
   * Watch all approved occurrences for active templates in a group
   */
  watchAllApprovedOccurrences(
    groupId: string,
    templates: RecurringTemplateDocument[],
    callback: (occurrences: RecurringOccurrenceDocument[]) => void
  ) {
    if (templates.length === 0) {
      callback([]);
      return () => {};
    }

    const occurrencesMap = new Map<string, RecurringOccurrenceDocument[]>();
    const unsubscribes: (() => void)[] = [];

    const triggerCallback = () => {
      const all: RecurringOccurrenceDocument[] = [];
      occurrencesMap.forEach((list) => {
        all.push(...list);
      });
      // Sort by date ascending
      all.sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate));
      callback(all);
    };

    templates.forEach((temp) => {
      const q = query(
        collection(db, `groups/${groupId}/recurringTemplates/${temp.id}/occurrences`),
        where("status", "==", "approved")
      );

      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const list: RecurringOccurrenceDocument[] = [];
          snapshot.forEach((d) => {
            list.push(d.data() as RecurringOccurrenceDocument);
          });
          occurrencesMap.set(temp.id, list);
          triggerCallback();
        },
        (error) => {
          console.error(`Failed to watch approved occurrences for template ${temp.id}:`, error);
        }
      );
      unsubscribes.push(unsub);
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  },
};
