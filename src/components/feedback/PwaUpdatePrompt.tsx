import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Sparkles, X } from "lucide-react";
import { Button } from "../ui/Button";
import { syncManager } from "../../infrastructure/offline/syncManager";

/**
 * How often (ms) to re-check for a waiting service worker after user clicks "Later".
 * Keeps the popup from disappearing forever when a real update is waiting.
 */
const RE_CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Detect Capacitor native shell — PWA service-worker updates don't apply there.
 */
function isNativePlatform(): boolean {
  try {
    const win = window as unknown as {
      Capacitor?: { isNativePlatform?: () => boolean };
    };
    return (
      typeof win?.Capacitor?.isNativePlatform === "function" &&
      win.Capacitor.isNativePlatform()
    );
  } catch {
    return false;
  }
}

export const PwaUpdatePrompt: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      console.log("[PwaUpdatePrompt] SW registered:", r);

      // Set up periodic re-check for a waiting service worker.
      // This covers the case where the user clicked "Later" and a new SW
      // was detected later, or the initial detection event was missed.
      if (r) {
        intervalRef.current = setInterval(() => {
          r.update().catch(console.error);
        }, RE_CHECK_INTERVAL_MS);
      }
    },
    onRegisterError(error: unknown) {
      console.error("[PwaUpdatePrompt] SW registration error:", error);
    },
  });

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // When a new waiting SW is found after user previously dismissed, re-show prompt
  useEffect(() => {
    if (needRefresh && dismissed) {
      // A fresh needRefresh signal from useRegisterSW after the user previously
      // clicked "Later" — re-surface the popup so they see the new version.
      setDismissed(false);
    }
  }, [needRefresh]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * "Later" — hide the popup but do NOT clear the waiting service worker.
   * The waiting SW stays in "waiting" state so the prompt can re-appear later.
   */
  const handleLater = useCallback(() => {
    setDismissed(true);
    // Only dismiss the offline-ready toast; do NOT call setNeedRefresh(false)
    // because that would clear the waiting SW reference inside useRegisterSW.
    setOfflineReady(false);
  }, [setOfflineReady]);

  /**
   * Close the offline-ready toast (no update involved).
   */
  const closeOfflineToast = useCallback(() => {
    setOfflineReady(false);
  }, [setOfflineReady]);

  /**
   * "Update Now" — check mutation safety → post SKIP_WAITING → reload.
   *
   * Safety: if syncManager has pending/processing operations in the outbox,
   * we warn the user rather than silently discarding data.
   */
  const handleUpdateNow = useCallback(async () => {
    try {
      setIsUpdating(true);

      // Check for in-flight mutations
      const outbox = await syncManager.getOutboxState();
      const pendingOps = outbox.operations.filter(
        (op) => op.status === "pending" || op.status === "processing"
      );
      const pendingReceipts = outbox.receipts.filter(
        (r) => r.status === "queued" || r.status === "uploading"
      );

      if (pendingOps.length > 0 || pendingReceipts.length > 0) {
        const totalPending = pendingOps.length + pendingReceipts.length;
        const proceed = window.confirm(
          `You have ${totalPending} unsaved change${totalPending > 1 ? "s" : ""} still syncing. ` +
            `Updating now may delay their upload. Continue with update?`
        );
        if (!proceed) {
          setIsUpdating(false);
          return;
        }
      }

      // Post SKIP_WAITING to the waiting service worker, then reload.
      // updateServiceWorker(true) from vite-plugin-pwa internally posts the
      // message and reloads once the new SW takes control.
      await updateServiceWorker(true);

      // Note: the page will reload after the SW activates.
      // Firebase auth persists in IndexedDB (browserLocalPersistence) or
      // sessionStorage (browserSessionPersistence), so the session survives.
    } catch (err) {
      console.error("[PwaUpdatePrompt] Update failed:", err);
      setIsUpdating(false);
    }
  }, [updateServiceWorker]);

  // ── Gate: never render on Capacitor native platforms ──
  if (isNativePlatform()) return null;

  // ── Gate: nothing to show ──
  const showUpdate = needRefresh && !dismissed;
  const showOffline = offlineReady && !needRefresh;
  if (!showUpdate && !showOffline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:bottom-6 max-w-sm glass-elevated border border-white/10 rounded-xl p-4 shadow-2xl flex flex-col gap-3 z-50 transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-accent-indigo/10 text-accent-indigo shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-text-primary">
              {showUpdate ? "New update available" : "Offline Ready"}
            </h4>
            <p className="text-xs text-text-muted mt-1 leading-normal">
              {showUpdate
                ? "A new version of FairTab is ready. Your current session is safe."
                : "FairTab has been cached for offline use. You can access it without connection."}
            </p>
          </div>
        </div>

        {/* X button only on offline toast — update toast uses Later/Update buttons */}
        {showOffline && (
          <button
            onClick={closeOfflineToast}
            className="p-1 rounded-full text-text-secondary hover:bg-white/5 hover:text-text-primary transition-colors cursor-pointer min-w-[28px] min-h-[28px] flex items-center justify-center"
            aria-label="Close notification"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showUpdate && (
        <div className="flex items-center gap-2 mt-1">
          <Button
            variant="gradient"
            size="sm"
            onClick={handleUpdateNow}
            disabled={isUpdating}
            className="w-full text-xs font-semibold py-1.5"
          >
            {isUpdating ? "Updating…" : "Update Now"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleLater}
            disabled={isUpdating}
            className="w-1/2 text-xs font-medium py-1.5"
          >
            Later
          </Button>
        </div>
      )}
    </div>
  );
};
export default PwaUpdatePrompt;
