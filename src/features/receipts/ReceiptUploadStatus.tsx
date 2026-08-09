import React, { useEffect, useState, useCallback, useRef } from "react";
import { offlineDb } from "../../infrastructure/offline/db";
import type { ReceiptDraft } from "../../infrastructure/offline/db";
import { syncManager } from "../../infrastructure/offline/syncManager";
import { auth } from "../../infrastructure/firebase/firebase";
import { Loader2, AlertCircle, Clock, CheckCircle } from "lucide-react";

export const ReceiptUploadStatus: React.FC<{ groupId: string }> = ({ groupId }) => {
  const [receiptDrafts, setReceiptDrafts] = useState<ReceiptDraft[]>([]);
  const mountedRef = useRef(true);

  const fetchDrafts = useCallback(async () => {
    const currentUid = auth.currentUser?.uid || "anonymous";
    try {
      const drafts = await offlineDb.receiptDrafts
        .where("groupId")
        .equals(groupId)
        .filter((d) => d.uid === currentUid)
        .toArray();
      if (mountedRef.current) {
        setReceiptDrafts(drafts);
      }
    } catch (e) {
      console.error("Failed to fetch receipt drafts", e);
    }
  }, [groupId]);

  useEffect(() => {
    mountedRef.current = true;

    // Subscribe to sync changes; listener callback triggers async fetch
    const unsubscribe = syncManager.registerListener(() => {
      fetchDrafts();
    });

    // Schedule initial fetch after mount (deferred to avoid synchronous setState)
    const timerId = setTimeout(() => {
      fetchDrafts();
    }, 0);

    return () => {
      mountedRef.current = false;
      clearTimeout(timerId);
      unsubscribe();
    };
  }, [fetchDrafts]);

  if (receiptDrafts.length === 0) return null;

  return (
    <div className="glass-elevated border border-white/10 rounded-xl p-4 space-y-3">
      <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Receipt Upload Queue</h3>
      <div className="space-y-2">
        {receiptDrafts.map((draft) => {
          let icon = <Clock className="w-4 h-4 text-white/40" />;
          let statusText = "Queued offline";
          let badgeColor = "bg-white/5 border-white/10 text-white/60";

          if (draft.status === "uploading") {
            icon = <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />;
            statusText = "Uploading...";
            badgeColor = "bg-sky-500/10 border-sky-500/20 text-sky-400";
          } else if (draft.status === "failed") {
            icon = <AlertCircle className="w-4 h-4 text-rose-400" />;
            statusText = draft.errorMessage || "Upload failed";
            badgeColor = "bg-rose-500/10 border-rose-500/20 text-rose-400";
          } else if (draft.status === "uploaded" || draft.status === "attached") {
            icon = <CheckCircle className="w-4 h-4 text-emerald-400" />;
            statusText = "Server Confirmed";
            badgeColor = "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
          }

          return (
            <div
              key={draft.id}
              className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${badgeColor}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {icon}
                <div className="truncate">
                  <p className="font-medium truncate text-white">{draft.fileName}</p>
                  <p className="text-[10px] opacity-75 truncate">{statusText}</p>
                </div>
              </div>
              <span className="text-[10px] opacity-60">
                {new Date(draft.createdAt).toLocaleTimeString()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
