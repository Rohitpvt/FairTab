/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import { toast } from "sonner";
import {
  User as UserIcon,
  Database,
  Download,
  Trash2,
  Lock,
  Info,
  LogOut,
  Edit2,
  Check
} from "lucide-react";
import { PageContainer } from "../../components/layout/PageContainer";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialogs";
import { useAuth } from "../auth/AuthProvider";
import { profileService } from "../../infrastructure/firebase/profileService";
import { accountService } from "../../infrastructure/firebase/accountService";
import { EmailAuthProvider, reauthenticateWithCredential, GoogleAuthProvider, reauthenticateWithPopup } from "firebase/auth";
import { purgeUserOfflineData } from "../../infrastructure/offline/db";
import { fetchUserExportData, generateCsvLedger, triggerDownload } from "../../utils/exportHelper";

export const SettingsPage: React.FC = () => {
  const { user, profile, refreshProfile, signOut, trustedDevice, setTrustedDevicePreference } = useAuth();
  
  const [syncOnStart, setSyncOnStart] = useState(true);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  
  // Profile editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(profile?.displayName || user?.displayName || "");
  const [isSavingName, setIsSavingName] = useState(false);

  const [isExporting, setIsExporting] = useState(false);

  const handleExportDataJson = async () => {
    if (!user) return;
    setIsExporting(true);
    const toastId = toast.loading("Compressing and downloading JSON ledger package...");
    try {
      const data = await fetchUserExportData(user.uid);
      const jsonStr = JSON.stringify(data, null, 2);
      const dateStr = new Date().toISOString().split("T")[0];
      triggerDownload(jsonStr, `FairTab_backup_${dateStr}.json`, "application/json");
      toast.success("JSON backup package downloaded successfully!", { id: toastId });
    } catch (e: any) {
      console.error(e);
      toast.error("JSON Export failed: " + e.message, { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportDataCsv = async (csvType: "expenses" | "shares" | "settlements") => {
    if (!user) return;
    setIsExporting(true);
    const toastId = toast.loading(`Compiling and downloading ${csvType.toUpperCase()} CSV ledger...`);
    try {
      const data = await fetchUserExportData(user.uid);
      const { expensesCsv, sharesCsv, settlementsCsv } = generateCsvLedger(data);
      const dateStr = new Date().toISOString().split("T")[0];
      if (csvType === "expenses") {
        triggerDownload(expensesCsv, `FairTab_expenses_${dateStr}.csv`, "text/csv");
      } else if (csvType === "shares") {
        triggerDownload(sharesCsv, `FairTab_expense_shares_${dateStr}.csv`, "text/csv");
      } else if (csvType === "settlements") {
        triggerDownload(settlementsCsv, `FairTab_settlements_${dateStr}.csv`, "text/csv");
      }
      toast.success(`${csvType.toUpperCase()} CSV downloaded successfully!`, { id: toastId });
    } catch (e: any) {
      console.error(e);
      toast.error("CSV Export failed: " + e.message, { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearCache = async () => {
    if (!user) return;
    const toastId = toast.loading("Flushing offline IndexedDB cache tables...");
    try {
      await purgeUserOfflineData(user.uid);
      toast.success("Device storage cache cleared safely! Offline draft tables reset completed.", { id: toastId });
    } catch (e: any) {
      console.error(e);
      toast.error("Clear failed: " + e.message, { id: toastId });
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setIsDeleting(true);
    const toastId = toast.loading("Processing account deletion...");
    try {
      // 1. Re-authenticate user
      const isGoogleUser = user.providerData.some((p) => p.providerId === "google.com");
      if (isGoogleUser) {
        toast.info("Re-authenticating with Google provider. Please approve the popup...", { id: toastId });
        const provider = new GoogleAuthProvider();
        await reauthenticateWithPopup(user, provider);
      } else {
        if (!deletePassword) {
          toast.error("Please enter your current password to confirm account deletion.", { id: toastId });
          setIsDeleting(false);
          return;
        }
        const credential = EmailAuthProvider.credential(user.email!, deletePassword);
        await reauthenticateWithCredential(user, credential);
      }

      // 2. Call deleteAccount Cloud Function for server-side ownership check and index leaving
      toast.loading("Running server-side group and profile cleanups...", { id: toastId });
      await accountService.deleteAccount({});

      // 3. Purge user-scoped IndexedDB tables
      await purgeUserOfflineData(user.uid);

      // 4. Sign out session
      await signOut();

      toast.success("Account deleted successfully. We are sorry to see you go!", { id: toastId });
      setIsDeleteOpen(false);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to delete account. Please try again.", { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveName = async () => {
    if (!user) return;
    if (!editName.trim()) {
      toast.error("Name cannot be empty.");
      return;
    }
    setIsSavingName(true);
    try {
      await profileService.updateUserProfile(user.uid, {
        displayName: editName.trim()
      });
      await refreshProfile();
      setIsEditingName(false);
      toast.success("Display name updated successfully!");
    } catch (error: unknown) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      toast.error(errorObj.message || "Failed to update display name.");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleTogglePersistence = async () => {
    const newValue = !trustedDevice;
    toast.info("Changing device persistence configuration. Reloading secure cache...");
    setTimeout(async () => {
      await setTrustedDevicePreference(newValue, true); // reloads automatically
    }, 1000);
  };

  return (
    <PageContainer
      title="Settings"
      description="Manage your account profile, device cache parameters, and data compliance."
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Settings Sections */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* User profile */}
          <GlassPanel variant="standard" className="flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-3 justify-between">
              <div className="flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-accent-indigo" />
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                  User Profile
                </h3>
              </div>
              <button
                type="button"
                onClick={() => signOut()}
                className="flex items-center gap-1.5 text-xs text-text-muted hover:text-danger hover:underline transition-colors cursor-pointer"
                title="Sign out of your session"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {isEditingName ? (
                <div className="flex items-center gap-2 w-full max-w-sm">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="px-3 py-1.5 bg-surface-primary border border-white/10 rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-cyan flex-grow"
                    disabled={isSavingName}
                    autoFocus
                  />
                  <Button
                    variant="gradient"
                    size="sm"
                    onClick={handleSaveName}
                    isLoading={isSavingName}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditName(profile?.displayName || user?.displayName || "");
                      setIsEditingName(false);
                    }}
                    disabled={isSavingName}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-text-primary">
                      {profile?.displayName || user?.displayName || "FairTab User"}
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsEditingName(true)}
                      className="text-text-muted hover:text-text-primary p-0.5 cursor-pointer"
                      aria-label="Edit display name"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">{user?.email}</p>
                </div>
              )}
            </div>
          </GlassPanel>

          {/* Sync & Local Storage parameters */}
          <GlassPanel variant="standard" className="flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <Database className="h-5 w-5 text-accent-cyan" />
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                Device Storage & Sync
              </h3>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-semibold text-text-primary">Offline Local Persistence</h4>
                  <p className="text-[10px] text-text-muted mt-0.5 leading-normal">
                    Store group lists and ledger entries locally on this device via IndexedDB caches. (Requires trusted device permission)
                  </p>
                </div>
                <button
                  onClick={handleTogglePersistence}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                    trustedDevice ? "bg-accent-indigo" : "bg-white/10"
                  }`}
                  aria-label="Toggle offline persistence"
                >
                  <div
                    className={`h-5 w-5 rounded-full bg-text-primary shadow-sm transform transition-transform ${
                      trustedDevice ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-white/5 pt-4">
                <div>
                  <h4 className="text-xs font-semibold text-text-primary">Synchronize on Startup</h4>
                  <p className="text-[10px] text-text-muted mt-0.5 leading-normal">
                    Automatically replay offline mutations and update balances when opening the application.
                  </p>
                </div>
                <button
                  onClick={() => setSyncOnStart(!syncOnStart)}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                    syncOnStart ? "bg-accent-indigo" : "bg-white/10"
                  }`}
                  aria-label="Toggle sync on start"
                >
                  <div
                    className={`h-5 w-5 rounded-full bg-text-primary shadow-sm transform transition-transform ${
                      syncOnStart ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </GlassPanel>

          {/* Export tools */}
          <GlassPanel variant="standard" className="flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <Download className="h-5 w-5 text-success" />
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                Data Portability & Export
              </h3>
            </div>
            <div className="flex flex-col gap-3">
              <Button
                variant="secondary"
                size="sm"
                className="w-full justify-center"
                onClick={handleExportDataJson}
                disabled={isExporting}
              >
                Export Canonical JSON Backup
              </Button>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full justify-center text-[10px] md:text-xs"
                  onClick={() => handleExportDataCsv("expenses")}
                  disabled={isExporting}
                >
                  Expenses CSV
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full justify-center text-[10px] md:text-xs"
                  onClick={() => handleExportDataCsv("shares")}
                  disabled={isExporting}
                >
                  Splits CSV
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full justify-center text-[10px] md:text-xs"
                  onClick={() => handleExportDataCsv("settlements")}
                  disabled={isExporting}
                >
                  Settlements CSV
                </Button>
              </div>
            </div>
          </GlassPanel>
        </div>

        {/* Danger zone side pane */}
        <div className="flex flex-col gap-6">
          <GlassPanel variant="standard" className="flex flex-col gap-4 border-danger/10">
            <div className="flex items-center gap-2 text-danger border-b border-white/5 pb-3">
              <Trash2 className="h-5 w-5" />
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                Danger Zone
              </h3>
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-[10px] text-text-muted leading-relaxed">
                Actions in this section can cause permanent change to your local application status or cloud session membership.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="w-full text-danger border-danger/20 hover:bg-danger/5 justify-center py-2"
                onClick={handleClearCache}
              >
                Flush Local Cache
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="w-full bg-danger text-text-primary hover:bg-opacity-90 justify-center py-2 border-none"
                onClick={() => setIsDeleteOpen(true)}
              >
                Delete Account
              </Button>
            </div>
          </GlassPanel>

          <div className="flex items-start gap-2.5 text-text-muted p-4 rounded-xl border border-white/5 bg-white/5 text-[10px]">
            <Info className="h-4 w-4 shrink-0 text-accent-cyan mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold text-text-secondary">App Version:</span> 1.0.0-Beta
              <br />
              <span className="font-semibold text-text-secondary">Environment:</span> Phase 2 Auth Suite
              <br />
              <span className="font-semibold text-text-secondary">Device:</span> {trustedDevice ? "Trusted Device (IndexedDB Cache)" : "Temporary Session (Memory Cache)"}
            </div>
          </div>
        </div>
      </div>

      {/* Account Deletion Confirmation Warning Dialog */}
      <Dialog
        isOpen={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Delete Account Permanently?"
        description="This action cannot be undone. All your personal profiles and login setups will be deleted."
        footer={
          <div className="flex gap-2 w-full justify-end">
            <Button variant="ghost" onClick={() => {
              setIsDeleteOpen(false);
              setDeletePassword("");
            }} size="sm">
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleDeleteAccount}
              className="bg-danger text-text-primary hover:bg-opacity-90 border-none"
              isLoading={isDeleting}
              loadingText="Deleting..."
              size="sm"
            >
              Confirm Delete
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4 text-left">
          <div className="flex items-start gap-3 p-3 bg-danger/10 border border-danger/20 rounded-lg text-xs text-danger leading-relaxed">
            <Lock className="h-5 w-5 shrink-0 mt-0.5" />
            <p>
              <span className="font-bold">Important Warning:</span> The ledger equations and balances in groups where you participated will remain listed to prevent financial calculation errors for other members, but your name details will be anonymized.
            </p>
          </div>

          {user?.providerData.some((p) => p.providerId === "password") ? (
            <div className="flex flex-col gap-2 border-t border-white/5 pt-3">
              <label htmlFor="delete-passwd" className="text-xs font-semibold text-text-secondary">
                Verify Password to Authenticate *
              </label>
              <input
                id="delete-passwd"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan"
                disabled={isDeleting}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1 border-t border-white/5 pt-3">
              <p className="text-xs text-text-muted">
                Requires recent Google authentication. Click <span className="font-semibold text-text-primary">Confirm Delete</span> to prompt Google credentials login.
              </p>
            </div>
          )}
        </div>
      </Dialog>
    </PageContainer>
  );
};
export default SettingsPage;
