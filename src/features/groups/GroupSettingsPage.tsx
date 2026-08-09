/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Landmark, Download, Trash2 } from "lucide-react";
import { PageContainer } from "../../components/layout/PageContainer";
import { Button } from "../../components/ui/Button";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { groupSchema } from "./groupSchema";
import type { GroupFormData, GroupDocument } from "./groupSchema";
import { groupService } from "../../infrastructure/firebase/groupService";
import { auth } from "../../infrastructure/firebase/firebase";
import { toast } from "sonner";
import { Skeleton } from "../../components/ui/Skeleton";
import { canEditSettings, canArchiveGroup } from "./permissions";
import { fetchUserExportData, generateCsvLedger, triggerDownload } from "../../utils/exportHelper";

import ArchiveGroupDialog from "./ArchiveGroupDialog";
import DeleteGroupDialog from "./DeleteGroupDialog";

export const GroupSettingsPage: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();

  const [group, setGroup] = useState<GroupDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string>("viewer");

  const [isExporting, setIsExporting] = useState(false);

  const handleExportGroupJson = async () => {
    if (!groupId || !auth.currentUser || !group) return;
    setIsExporting(true);
    const toastId = toast.loading("Compressing and downloading group JSON package...");
    try {
      const data = await fetchUserExportData(auth.currentUser.uid);
      const groupExport = data.groups.find((g) => g.group.id === groupId);
      if (!groupExport) {
        throw new Error("Group not found in backup data.");
      }
      const jsonStr = JSON.stringify(groupExport, null, 2);
      triggerDownload(jsonStr, `FairTab_group_${group.name}_backup.json`, "application/json");
      toast.success("Group JSON backup downloaded successfully!", { id: toastId });
    } catch (e: any) {
      console.error(e);
      toast.error("Group JSON Export failed: " + e.message, { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportGroupCsv = async (csvType: "expenses" | "shares" | "settlements") => {
    if (!groupId || !auth.currentUser || !group) return;
    setIsExporting(true);
    const toastId = toast.loading(`Compiling and downloading group ${csvType.toUpperCase()} CSV...`);
    try {
      const data = await fetchUserExportData(auth.currentUser.uid);
      const groupExport = data.groups.find((g) => g.group.id === groupId);
      if (!groupExport) {
        throw new Error("Group not found in backup data.");
      }
      // Wrap it in a single export structure
      const wrappedData = {
        userProfile: {},
        exportedAt: new Date().toISOString(),
        groups: [groupExport],
      };
      const { expensesCsv, sharesCsv, settlementsCsv } = generateCsvLedger(wrappedData);
      if (csvType === "expenses") {
        triggerDownload(expensesCsv, `FairTab_group_${group.name}_expenses.csv`, "text/csv");
      } else if (csvType === "shares") {
        triggerDownload(sharesCsv, `FairTab_group_${group.name}_expense_shares.csv`, "text/csv");
      } else if (csvType === "settlements") {
        triggerDownload(settlementsCsv, `FairTab_group_${group.name}_settlements.csv`, "text/csv");
      }
      toast.success(`Group ${csvType.toUpperCase()} CSV downloaded successfully!`, { id: toastId });
    } catch (e: any) {
      console.error(e);
      toast.error("Group CSV Export failed: " + e.message, { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<GroupFormData>({
    resolver: zodResolver(groupSchema) as unknown as Resolver<GroupFormData>,
  });

  useEffect(() => {
    if (!groupId) return;
    const unsubscribeGroup = groupService.watchGroup(groupId, (data) => {
      if (data) {
        setGroup(data);
        reset({
          name: data.name,
          description: data.description || "",
          type: data.type,
          baseCurrency: data.baseCurrency,
          simplifyDebts: data.simplifyDebts,
          settlementStrategy: data.settlementStrategy,
        });
      } else {
        setGroup(null);
      }
      setIsLoading(false);
    });

    const unsubscribeMembers = groupService.watchMembers(groupId, (members) => {
      const currentUserUid = auth.currentUser?.uid;
      const currentMember = members.find((m) => m.userId === currentUserUid);
      setCurrentUserRole(currentMember?.role || "viewer");
    });

    return () => {
      unsubscribeGroup();
      unsubscribeMembers();
    };
  }, [groupId, reset]);

  if (isLoading) {
    return (
      <PageContainer title="Loading Settings..." description="Reading group configurations...">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </PageContainer>
    );
  }

  if (!group || group.status === "deleted" || !canEditSettings(currentUserRole as "owner" | "admin" | "member" | "viewer")) {
    return (
      <PageContainer title="Access Denied" description="You do not have permission to view group settings or this group has been deleted.">
        <div className="max-w-md mx-auto text-center mt-12">
          <Button onClick={() => navigate("/groups")} variant="gradient" className="w-full">
            Return to Groups
          </Button>
        </div>
      </PageContainer>
    );
  }

  const onSubmit = async (data: GroupFormData) => {
    setIsSaving(true);
    try {
      await groupService.updateGroup(group.id, data, group.version);
      toast.success("Group settings updated successfully!");
      navigate(`/groups/${group.id}`);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast.error(err.message || "Failed to update settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageContainer
      title="Group Settings"
      description={`Update settings for split ledger group "${group.name}".`}
    >
      <div className="max-w-xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate(`/groups/${group.id}`)}
          className="flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-text-primary mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Group Detail
        </button>

        <div className="flex flex-col gap-6">
          {/* Edit Form */}
          <div className="glass-elevated border border-white/10 rounded-2xl p-6 md:p-8">
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 text-left">
              {/* Group Name */}
              <div className="flex flex-col gap-2">
                <label htmlFor="grp-name" className="text-sm font-semibold text-text-secondary">
                  Group Name *
                </label>
                <input
                  id="grp-name"
                  type="text"
                  {...register("name")}
                  placeholder="e.g. Apartment bills"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan transition-colors"
                />
                {errors.name && (
                  <span className="text-xs text-danger font-medium mt-0.5">{errors.name.message}</span>
                )}
              </div>

              {/* Description */}
              <div className="flex flex-col gap-2">
                <label htmlFor="grp-desc" className="text-sm font-semibold text-text-secondary">
                  Description
                </label>
                <textarea
                  id="grp-desc"
                  {...register("description")}
                  placeholder="Trips agenda or rent policies..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan transition-colors resize-none"
                />
                {errors.description && (
                  <span className="text-xs text-danger font-medium mt-0.5">{errors.description.message}</span>
                )}
              </div>

              {/* Group Type & Base Currency Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Group Type */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="grp-type" className="text-sm font-semibold text-text-secondary">
                    Group Type
                  </label>
                  <select
                    id="grp-type"
                    {...register("type")}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-accent-cyan transition-colors [&>option]:bg-[#0c0f1d]"
                  >
                    <option value="trip">✈️ Trip</option>
                    <option value="home">🏠 Home & Rent</option>
                    <option value="couple">❤️ Couple</option>
                    <option value="event">🎉 Event</option>
                    <option value="project">💻 Project</option>
                    <option value="other">📦 Other</option>
                  </select>
                </div>

                {/* Base Currency */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="grp-currency" className="text-sm font-semibold text-text-secondary">
                    Base Currency
                  </label>
                  <select
                    id="grp-currency"
                    {...register("baseCurrency")}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-text-primary focus:outline-none focus:border-accent-cyan transition-colors [&>option]:bg-[#0c0f1d]"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="JPY">JPY (¥)</option>
                  </select>
                </div>
              </div>

              {/* Debt Simplification */}
              <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                <div className="flex flex-col gap-1 pr-4">
                  <div className="flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-accent-indigo" />
                    <span className="text-sm font-semibold text-text-primary">Simplify Debts</span>
                  </div>
                  <span className="text-xs text-text-muted">
                    Consolidate transactions automatically for simple settlement paths.
                  </span>
                </div>
                <input
                  id="grp-simplify"
                  type="checkbox"
                  {...register("simplifyDebts")}
                  className="w-4 h-4 rounded border-white/10 bg-white/5 text-accent-cyan focus:ring-accent-cyan"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 mt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate(`/groups/${group.id}`)}
                  className="flex-1"
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="gradient"
                  className="flex-1"
                  isLoading={isSaving}
                  loadingText="Saving..."
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </div>

          {/* Export Group Data Section (Owner/Admin only) */}
          {(currentUserRole === "owner" || currentUserRole === "admin") && (
            <GlassPanel variant="standard" className="flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                <Download className="h-5 w-5 text-success" />
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider text-left">
                  Export Group Data
                </h3>
              </div>
              <div className="flex flex-col gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full justify-center text-xs"
                  onClick={handleExportGroupJson}
                  disabled={isExporting}
                >
                  Export Group JSON Backup
                </Button>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full justify-center text-[10px] md:text-xs"
                    onClick={() => handleExportGroupCsv("expenses")}
                    disabled={isExporting}
                  >
                    Expenses CSV
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full justify-center text-[10px] md:text-xs"
                    onClick={() => handleExportGroupCsv("shares")}
                    disabled={isExporting}
                  >
                    Splits CSV
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full justify-center text-[10px] md:text-xs"
                    onClick={() => handleExportGroupCsv("settlements")}
                    disabled={isExporting}
                  >
                    Settlements CSV
                  </Button>
                </div>
              </div>
            </GlassPanel>
          )}

          {/* Danger Zone: Archive & Delete */}
          <div className="glass-elevated border border-danger/20 rounded-2xl p-6 text-left flex flex-col gap-4">
            <h4 className="text-sm font-bold text-danger flex items-center gap-1.5 border-b border-white/5 pb-3">
              <Trash2 className="h-4 w-4" /> Danger Zone
            </h4>

            {canArchiveGroup(currentUserRole as "owner" | "admin" | "member" | "viewer") && group.status === "active" && (
              <div className="flex justify-between items-center gap-4">
                <div className="pr-2">
                  <span className="text-xs font-semibold text-text-primary block">Archive Group</span>
                  <span className="text-[10px] text-text-muted">
                    Lock splits and make group read-only.
                  </span>
                </div>
                <Button
                  onClick={() => setIsArchiveOpen(true)}
                  variant="ghost"
                  className="bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20 shrink-0 text-xs py-1.5 px-3"
                >
                  Archive Group
                </Button>
              </div>
            )}

            {currentUserRole === "owner" && (
              <div className="flex justify-between items-center gap-4 border-t border-white/5 pt-4">
                <div className="pr-2">
                  <span className="text-xs font-semibold text-text-primary block">Delete Group</span>
                  <span className="text-[10px] text-text-muted">
                    Permanently lock group ledger. Requires typing the group name to confirm.
                  </span>
                </div>
                <Button
                  onClick={() => setIsDeleteOpen(true)}
                  variant="primary"
                  className="bg-danger hover:bg-opacity-90 text-text-primary border-none shrink-0 text-xs py-1.5 px-3"
                >
                  Delete Group
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ArchiveGroupDialog
        isOpen={isArchiveOpen}
        onClose={() => setIsArchiveOpen(false)}
        groupId={group.id}
        groupName={group.name}
        groupVersion={group.version}
      />

      <DeleteGroupDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        groupId={group.id}
        groupName={group.name}
      />
    </PageContainer>
  );
};

export default GroupSettingsPage;
