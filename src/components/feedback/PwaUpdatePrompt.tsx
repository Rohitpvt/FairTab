import React from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Sparkles, X } from "lucide-react";
import { Button } from "../ui/Button";

export const PwaUpdatePrompt: React.FC = () => {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r: ServiceWorkerRegistration | undefined) {
      console.log("SW registered:", r);
    },
    onRegisterError(error: unknown) {
      console.error("SW registration error:", error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) return null;

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
              {needRefresh ? "App Update Available" : "Offline Ready"}
            </h4>
            <p className="text-xs text-text-muted mt-1 leading-normal">
              {needRefresh
                ? "A new version of FairTab is ready. Reload to update safely."
                : "FairTab has been cached for offline use. You can access it without connection."}
            </p>
          </div>
        </div>
        <button
          onClick={close}
          className="p-1 rounded-full text-text-secondary hover:bg-white/5 hover:text-text-primary transition-colors cursor-pointer min-w-[28px] min-h-[28px] flex items-center justify-center"
          aria-label="Close notification"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {needRefresh && (
        <div className="flex items-center gap-2 mt-1">
          <Button
            variant="gradient"
            size="sm"
            onClick={() => updateServiceWorker(true)}
            className="w-full text-xs font-semibold py-1.5"
          >
            Update App
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={close}
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
