import React, { useEffect, useState } from "react";
import {
  WifiOff,
  CloudLightning,
  AlertCircle,
  FolderOpen,
  Sun,
  Moon,
  RefreshCw,
  CheckCircle,
} from "lucide-react";
import { Button } from "../ui/Button";
import { CoolLoader } from "./CoolLoader";

export { CoolLoader };

// RoutePending loader
export const RoutePending: React.FC = () => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center min-h-[400px] w-full gap-4 text-text-muted"
    >
      <CoolLoader size="sm" />
      <span className="text-xs font-semibold tracking-wider uppercase text-text-muted">Loading Section...</span>
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
    try {
      const savedTheme = localStorage.getItem("fairtab:theme") || localStorage.getItem("theme");
      if (savedTheme === "light" || savedTheme === "dark") {
        return savedTheme;
      }
      // System default fallback
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      return systemDark ? "dark" : "light";
    } catch {
      return "dark";
    }
  });

  useEffect(() => {
    const isDark = theme === "dark";
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.classList.toggle("light", !isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    try {
      localStorage.setItem("fairtab:theme", theme);
      // Deprecate legacy key
      localStorage.removeItem("theme");
    } catch {
      // Ignore write errors
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className="liquid-toggle-track focus-visible:outline-2 focus-visible:outline-accent-cyan"
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      title={`Switch to ${isDark ? "light" : "dark"} theme`}
    >
      {/* Background Track Icons */}
      <div className="w-full flex items-center justify-between px-1.5 pointer-events-none opacity-40">
        <Moon className={`h-3 w-3 text-cyan-400 transition-opacity duration-300 ${isDark ? "opacity-0" : "opacity-100"}`} />
        <Sun className={`h-3.5 w-3.5 text-amber-500 transition-opacity duration-300 ${!isDark ? "opacity-0" : "opacity-100"}`} />
      </div>

      {/* 3D Liquid Jelly Knob */}
      <div className="liquid-toggle-knob">
        {isDark ? (
          <Moon className="h-3 w-3 text-cyan-200 drop-shadow-[0_0_4px_rgba(56,189,248,0.8)]" />
        ) : (
          <Sun className="h-3 w-3 text-white drop-shadow-[0_0_4px_rgba(251,191,36,0.9)]" />
        )}
      </div>
    </button>
  );
};
