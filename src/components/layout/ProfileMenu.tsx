import React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Settings,
  Database,
  Download,
  Trash2,
  LogOut,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MemberAvatar } from "../ui/Avatar";
import { useAuth } from "../../features/auth/AuthProvider";
import { toast } from "sonner";
import { purgeUserOfflineData } from "../../infrastructure/offline/db";
import { fetchUserExportData, triggerDownload } from "../../utils/exportHelper";

export const ProfileMenu: React.FC = () => {
  const { user, profile, signOut, trustedDevice, setTrustedDevicePreference } = useAuth();
  const navigate = useNavigate();

  const name = profile?.displayName || user?.displayName || user?.email || "User";
  const email = user?.email || "";
  const avatarUrl = profile?.photoURL || user?.photoURL || "";

  const handleExportDataJson = async () => {
    if (!user) return;
    const toastId = toast.loading("Compressing and downloading JSON backup...");
    try {
      const data = await fetchUserExportData(user.uid);
      const jsonStr = JSON.stringify(data, null, 2);
      const dateStr = new Date().toISOString().split("T")[0];
      triggerDownload(jsonStr, `FairTab_backup_${dateStr}.json`, "application/json");
      toast.success("JSON backup downloaded successfully!", { id: toastId });
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("JSON Export failed: " + msg, { id: toastId });
    }
  };

  const handleClearCache = async () => {
    if (!user) return;
    const toastId = toast.loading("Flushing offline IndexedDB cache...");
    try {
      await purgeUserOfflineData(user.uid);
      toast.success("Device storage cache cleared safely!", { id: toastId });
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Clear failed: " + msg, { id: toastId });
    }
  };

  const handleTogglePersistence = async () => {
    const newValue = !trustedDevice;
    toast.info("Changing device persistence configuration. Reloading secure cache...");
    setTimeout(async () => {
      await setTrustedDevicePreference(newValue, true);
    }, 800);
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="flex items-center gap-2 pl-1 pr-1.5 py-1 rounded-full hover:bg-white/10 active:scale-95 transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan border border-transparent hover:border-white/10"
          aria-label="User profile settings menu"
        >
          <MemberAvatar name={name} avatarUrl={avatarUrl} size="sm" />
          <span className="text-xs font-semibold text-text-secondary hidden lg:inline max-w-[120px] truncate">
            {name}
          </span>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="w-72 glass-elevated border border-white/15 rounded-2xl p-2 shadow-2xl z-50 animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 focus:outline-none"
        >
          {/* User Profile Card Header */}
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.04] border border-white/5 mb-1">
            <MemberAvatar name={name} avatarUrl={avatarUrl} size="md" />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-bold text-text-primary truncate">
                {name}
              </span>
              <span className="text-[11px] text-text-muted truncate">
                {email}
              </span>
            </div>
          </div>

          <DropdownMenu.Separator className="h-px bg-white/10 my-1" />

          {/* Core Settings / Navigation Links */}
          <DropdownMenu.Item
            onSelect={() => navigate("/settings")}
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-white/10 rounded-xl cursor-pointer transition-colors focus:bg-white/10 focus:outline-none select-none"
          >
            <Settings className="h-4 w-4 text-accent-indigo shrink-0" />
            <span className="flex-1">Full Account Settings</span>
            <ExternalLink className="h-3 w-3 opacity-50" />
          </DropdownMenu.Item>

          <DropdownMenu.Item
            onSelect={() => navigate("/insights")}
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-white/10 rounded-xl cursor-pointer transition-colors focus:bg-white/10 focus:outline-none select-none"
          >
            <Sparkles className="h-4 w-4 text-accent-violet shrink-0" />
            <span className="flex-1">Smart Insights</span>
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="h-px bg-white/10 my-1" />

          {/* Quick Preferences & Actions */}
          <div className="px-3 py-1.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <Database className="h-4 w-4 text-accent-cyan shrink-0" />
              <span>Offline Persistence</span>
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleTogglePersistence();
              }}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                trustedDevice ? "bg-accent-indigo" : "bg-white/10"
              }`}
              aria-label="Toggle offline persistence"
            >
              <div
                className={`h-4 w-4 rounded-full bg-text-primary shadow-sm transform transition-transform ${
                  trustedDevice ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <DropdownMenu.Item
            onSelect={handleExportDataJson}
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-white/10 rounded-xl cursor-pointer transition-colors focus:bg-white/10 focus:outline-none select-none"
          >
            <Download className="h-4 w-4 text-success shrink-0" />
            <span>Export JSON Backup</span>
          </DropdownMenu.Item>

          <DropdownMenu.Item
            onSelect={handleClearCache}
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-warning hover:bg-warning/10 rounded-xl cursor-pointer transition-colors focus:bg-warning/10 focus:outline-none select-none"
          >
            <Trash2 className="h-4 w-4 shrink-0" />
            <span>Flush Local Cache</span>
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="h-px bg-white/10 my-1" />

          {/* Sign Out Action */}
          <DropdownMenu.Item
            onSelect={() => signOut()}
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-danger hover:bg-danger/10 rounded-xl cursor-pointer transition-colors focus:bg-danger/10 focus:outline-none select-none"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Sign Out</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

export default ProfileMenu;
