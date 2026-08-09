import React, { useEffect, useState } from "react";
import {
  WifiOff,
  CloudLightning,
  AlertCircle,
  FolderOpen,
  Sun,
  Moon,
  Loader,
  RefreshCw,
  CheckCircle,
} from "lucide-react";
import { Button } from "../ui/Button";

// RoutePending loader
export const RoutePending: React.FC = () => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center min-h-[400px] w-full gap-4 text-text-muted"
    >
      <Loader className="h-8 w-8 animate-spin text-accent-indigo" />
      <span className="text-sm font-semibold tracking-wide uppercase">Loading Section...</span>
    </div>
  );
};

// EmptyState component
interface EmptyStateProps {
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionText,
  onAction,
  icon,
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 rounded-xl border border-dashed border-white/10 glass-subtle max-w-md mx-auto my-6">
      <div className="p-4 rounded-full bg-white/5 text-text-muted mb-4">
        {icon || <FolderOpen className="h-8 w-8" />}
      </div>
      <h3 className="text-base font-bold text-text-primary mb-1.5">{title}</h3>
      <p className="text-xs text-text-muted leading-relaxed mb-5">{description}</p>
      {actionText && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
};

// ErrorState component
interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Something went wrong",
  message,
  onRetry,
}) => {
  return (
    <div className="p-6 rounded-xl border border-danger/20 bg-danger/5 flex flex-col items-center text-center max-w-md mx-auto my-6">
      <div className="p-3 rounded-full bg-danger/10 text-danger mb-4">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="text-base font-bold text-text-primary mb-1">{title}</h3>
      <p className="text-xs text-text-muted mb-4">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry Action
        </Button>
      )}
    </div>
  );
};

// OfflineBanner component
export const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="bg-warning/15 border-b border-warning/20 px-4 py-2 flex items-center justify-center gap-2 text-warning text-xs font-semibold w-full"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>Offline Mode — Changes will sync when connection returns</span>
    </div>
  );
};

// SyncIndicator component
interface SyncIndicatorProps {
  pendingCount?: number;
  syncStatus?: "synced" | "syncing" | "failed" | "offline";
  onTriggerSync?: () => void;
}

export const SyncIndicator: React.FC<SyncIndicatorProps> = ({
  pendingCount = 0,
  syncStatus = "synced",
  onTriggerSync,
}) => {
  const getIndicator = () => {
    switch (syncStatus) {
      case "syncing":
        return (
          <div className="flex items-center gap-1.5 text-accent-cyan" aria-label="Synchronizing changes">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-xs font-semibold hidden sm:inline">Syncing</span>
          </div>
        );
      case "offline":
        return (
          <div className="flex items-center gap-1.5 text-warning" aria-label="Connection offline">
            <WifiOff className="h-4 w-4" />
            <span className="text-xs font-semibold hidden sm:inline">
              Offline {pendingCount > 0 && `(${pendingCount})`}
            </span>
          </div>
        );
      case "failed":
        return (
          <button
            onClick={onTriggerSync}
            className="flex items-center gap-1.5 text-danger hover:underline cursor-pointer"
            aria-label="Sync failed. Click to retry."
          >
            <CloudLightning className="h-4 w-4" />
            <span className="text-xs font-semibold hidden sm:inline">Retry Sync ({pendingCount})</span>
          </button>
        );
      case "synced":
      default:
        return (
          <div className="flex items-center gap-1.5 text-success/80" aria-label="All data synced">
            <CheckCircle className="h-4 w-4" />
            <span className="text-xs font-semibold hidden sm:inline">Synced</span>
          </div>
        );
    }
  };

  return <div className="inline-flex items-center justify-center">{getIndicator()}</div>;
};

export const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const savedTheme = localStorage.getItem("theme") as "dark" | "light" | null;
    return savedTheme || "dark";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    if (!localStorage.getItem("theme")) {
      localStorage.setItem("theme", "dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full hover:bg-white/5 text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-2 focus-visible:outline-accent-cyan cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
    >
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
};
