/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/purity */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Repeat,
  Calendar,
  AlertCircle,
  Play,
  Plus,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { PageContainer } from "../../components/layout/PageContainer";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Button } from "../../components/ui/Button";
import { groupService } from "../../infrastructure/firebase/groupService";
import { recurringService } from "../../infrastructure/firebase/recurringService";
import { syncManager } from "../../infrastructure/offline/syncManager";
import { formatCurrency } from "../../utils/format";
import type {
  RecurringTemplateDocument,
  RecurringOccurrenceDocument,
  ExpenseCategory,
  SplitMethod,
} from "@fairtab/domain";

// List of supported expense categories
const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "food", label: "Food & Dining" },
  { value: "transport", label: "Transportation" },
  { value: "housing", label: "Housing & Rent" },
  { value: "utilities", label: "Utilities & Bills" },
  { value: "entertainment", label: "Entertainment" },
  { value: "shopping", label: "Shopping" },
  { value: "health", label: "Health" },
  { value: "other", label: "Other" },
];

export const RecurringPage: React.FC = () => {
  const navigate = useNavigate();
  // We check if groupId is in URL. If not, we will let the user pick from active groups.
  const { groupId: routeGroupId } = useParams<{ groupId: string }>();

  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [members, setMembers] = useState<any[]>([]);

  const [templates, setTemplates] = useState<RecurringTemplateDocument[]>([]);
  const [occurrences, setOccurrences] = useState<RecurringOccurrenceDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);

  // Form modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingOccurrence, setEditingOccurrence] = useState<RecurringOccurrenceDocument | null>(null);

  // Foreground outbox sync status
  const [syncStatus, setSyncStatus] = useState({
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingCount: 0,
    failedCount: 0,
  });

  // Watch groups list
  useEffect(() => {
    const unsubSync = syncManager.registerListener((status) => {
      setSyncStatus(status);
    });

    const unsubGroups = groupService.watchUserGroups((data) => {
      const activeGroups = data.filter((g) => g.status === "active");
      setGroups(activeGroups);
      if (routeGroupId) {
        setSelectedGroupId(routeGroupId);
      } else if (activeGroups.length > 0 && !selectedGroupId) {
        setSelectedGroupId(activeGroups[0].groupId);
      }
    });

    return () => {
      unsubSync();
      unsubGroups();
    };
  }, [routeGroupId]);

  // Watch active group metadata & members
  useEffect(() => {
    if (!selectedGroupId) return;

    setIsLoading(true);
    const unsubMembers = groupService.watchMembers(selectedGroupId, (data) => {
      const activeMembers = data.filter((m) => m.status === "active");
      setMembers(activeMembers);
    });

    return () => {
      unsubMembers();
    };
  }, [selectedGroupId]);

  // Watch recurring templates & pending occurrences
  useEffect(() => {
    if (!selectedGroupId) return;

    const unsubTemplates = recurringService.watchTemplates(selectedGroupId, (temps) => {
      setTemplates(temps);

      // Now watch occurrences for these templates
      const unsubOccs = recurringService.watchAllPendingOccurrences(selectedGroupId, temps, (occs) => {
        setOccurrences(occs);
        setIsLoading(false);
      });

      return unsubOccs;
    });

    return () => {
      unsubTemplates();
    };
  }, [selectedGroupId]);

  const handleGroupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const gid = e.target.value;
    setSelectedGroupId(gid);
    if (gid) {
      navigate(`/groups/${gid}/recurring`);
    }
  };

  // Run generator scan (callable function)
  const handleTriggerGenerator = async () => {
    if (!selectedGroupId) return;
    setIsScanning(true);
    toast.loading("Scanning for due recurring occurrence drafts...", { id: "scan-toast" });

    try {
      const { httpsCallable } = await import("firebase/functions");
      const { functions } = await import("../../../src/infrastructure/firebase/firebase");
      const generateRecurringDraftsFn = httpsCallable<any, any>(functions, "generateRecurringDrafts");
      const res = await generateRecurringDraftsFn({ groupId: selectedGroupId });
      
      const count = res.data?.createdCount || 0;
      toast.success(
        count > 0
          ? `Draft generator completed: generated ${count} new pending drafts.`
          : "Draft generator completed: all bills are up to date.",
        { id: "scan-toast" }
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to trigger recurring drafts generator.", { id: "scan-toast" });
    } finally {
      setIsScanning(false);
    }
  };

  // Toggle template active status
  const handleToggleTemplate = async (template: RecurringTemplateDocument) => {
    if (!selectedGroupId) return;
    const newStatus = template.status === "active" ? "paused" : "active";

    const clientOperationId = `op-toggle-${template.id}-${Date.now()}`;
    const payload = {
      clientOperationId,
      groupId: selectedGroupId,
      templateId: template.id,
      status: newStatus,
    };

    try {
      if (syncStatus.isOnline) {
        toast.loading(`${newStatus === "active" ? "Resuming" : "Pausing"} template...`, { id: "toggle-toast" });
        const { httpsCallable } = await import("firebase/functions");
        const { functions } = await import("../../../src/infrastructure/firebase/firebase");
        const updateRecurringTemplateFn = httpsCallable<any, any>(functions, "updateRecurringTemplate");
        await updateRecurringTemplateFn(payload);
        toast.success(`Template ${newStatus === "active" ? "resumed" : "paused"} successfully.`, { id: "toggle-toast" });
      } else {
        await syncManager.queueUpdateRecurringTemplate(selectedGroupId, payload);
        toast.info("Offline: Pause/resume operation queued in outbox.", { id: "toggle-toast" });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle template status.", { id: "toggle-toast" });
    }
  };

  // Skip occurrence
  const handleSkipOccurrence = async (occ: RecurringOccurrenceDocument) => {
    if (!selectedGroupId) return;
    const clientOperationId = `op-skip-${occ.templateId}-${occ.occurrenceDate}-${Date.now()}`;
    const payload = {
      clientOperationId,
      groupId: selectedGroupId,
      templateId: occ.templateId,
      occurrenceDate: occ.occurrenceDate,
    };

    try {
      if (syncStatus.isOnline) {
        toast.loading("Skipping occurrence...", { id: "skip-toast" });
        const { httpsCallable } = await import("firebase/functions");
        const { functions } = await import("../../../src/infrastructure/firebase/firebase");
        const skipFn = httpsCallable<any, any>(functions, "skipRecurringOccurrence");
        await skipFn(payload);
        toast.success(`Occurrence ${occ.occurrenceDate} skipped.`, { id: "skip-toast" });
      } else {
        await syncManager.queueSkipRecurringDraft(selectedGroupId, payload);
        toast.info("Offline: Skip operation queued in outbox.", { id: "skip-toast" });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to skip occurrence.", { id: "skip-toast" });
    }
  };

  // Approve occurrence
  const handleApproveOccurrence = async (occ: RecurringOccurrenceDocument, adjustedPayload?: any) => {
    if (!selectedGroupId) return;
    const clientOperationId = `op-appr-${occ.templateId}-${occ.occurrenceDate}-${Date.now()}`;
    const expenseId = `exp-rec-${occ.templateId}-${occ.occurrenceDate}`;

    const payload = {
      clientOperationId,
      groupId: selectedGroupId,
      templateId: occ.templateId,
      occurrenceDate: occ.occurrenceDate,
      expenseId,
      ...adjustedPayload,
    };

    try {
      if (syncStatus.isOnline) {
        toast.loading("Posting recurring expense...", { id: "appr-toast" });
        const { httpsCallable } = await import("firebase/functions");
        const { functions } = await import("../../../src/infrastructure/firebase/firebase");
        const approveFn = httpsCallable<any, any>(functions, "approveRecurringDraft");
        await approveFn(payload);
        toast.success("Recurring draft posted to ledger!", { id: "appr-toast" });
      } else {
        await syncManager.queueApproveRecurringDraft(selectedGroupId, payload);
        toast.info("Offline: Approve operation queued in outbox.", { id: "appr-toast" });
      }
      setEditingOccurrence(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to approve occurrence.", { id: "appr-toast" });
    }
  };

  // Get matching template details
  const getTemplate = (id: string) => templates.find((t) => t.id === id);

  return (
    <PageContainer
      title="Recurring Expenses"
      description="Manage recurring subscriptions, monthly rent, and household utilities split automatically."
      action={
        selectedGroupId && (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleTriggerGenerator}
              disabled={isScanning}
              className="flex gap-2"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              Scan Due Bills
            </Button>
            <Button
              variant="gradient"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="flex gap-2"
            >
              <Plus className="h-3.5 w-3.5" />
              New Template
            </Button>
          </div>
        )
      }
    >
      {/* Group selector */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
        <div className="w-full md:w-80">
          <label className="block text-xs font-semibold text-text-secondary mb-1.5">
            Select Active Group
          </label>
          <div className="relative">
            <select
              value={selectedGroupId}
              onChange={handleGroupChange}
              className="w-full pl-3.5 pr-10 py-2.5 bg-surface-primary border border-white/10 rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-cyan cursor-pointer"
            >
              <option value="" disabled>-- Select Group --</option>
              {groups.map((g) => (
                <option key={g.groupId} value={g.groupId}>
                  {g.groupName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Offline cache warning banner */}
        {!syncStatus.isOnline && (
          <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl text-xs">
            <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
            <span>Viewing offline cache. Modifications are queued and will sync when internet reconnects.</span>
          </div>
        )}
      </div>

      {!selectedGroupId ? (
        <GlassPanel variant="standard" className="text-center p-8">
          <Repeat className="h-10 w-10 text-accent-indigo mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-text-primary">No Group Selected</h3>
          <p className="text-xs text-text-muted mt-1 max-w-xs mx-auto">
            Please choose or create a group first to manage recurring subscription bills.
          </p>
        </GlassPanel>
      ) : isLoading ? (
        <div className="flex flex-col gap-4">
          <GlassPanel variant="standard" className="h-20 animate-pulse bg-white/5" />
          <GlassPanel variant="standard" className="h-20 animate-pulse bg-white/5" />
        </div>
      ) : (
        <div className="flex flex-col gap-8 text-left">
          {/* Section 1: Pending occurrence drafts / reminders */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Clock className="h-4 w-4 text-accent-cyan" />
                Pending Due Occurrences ({occurrences.length})
              </h3>
              <span className="text-[10px] text-text-muted">Requires manual confirmation before posting</span>
            </div>

            {occurrences.length === 0 ? (
              <GlassPanel variant="subtle" className="text-center py-6 text-xs text-text-muted">
                No outstanding recurring drafts pending review. Run a scan to fetch newly due cycles.
              </GlassPanel>
            ) : (
              <div className="flex flex-col gap-3">
                {occurrences.map((occ) => {
                  const temp = getTemplate(occ.templateId);
                  if (!temp) return null;

                  return (
                    <GlassPanel
                      key={occ.id}
                      variant="standard"
                      className="border-l-4 border-l-accent-cyan p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-accent-cyan bg-accent-cyan/10 px-2 py-0.5 rounded-full capitalize">
                            Due: {occ.occurrenceDate}
                          </span>
                          <span className="text-xs text-text-muted">•</span>
                          <h4 className="text-sm font-semibold text-text-primary leading-tight truncate">
                            {temp.title}
                          </h4>
                        </div>

                        <p className="text-xs text-text-muted mt-1.5">
                          Amount: <span className="font-semibold text-text-secondary">{formatCurrency(temp.amountMinor, temp.currency)}</span>
                          {temp.currency !== temp.groupBaseCurrency && (
                            <span className="ml-1 text-[10px] text-text-muted">
                              (Base: {formatCurrency(Math.round(temp.amountMinor * temp.fx.numerator / temp.fx.denominator), temp.groupBaseCurrency)})
                            </span>
                          )}
                          {" "}| Split: <span className="capitalize">{temp.splitMethod}</span>
                        </p>

                        {/* Recalculated / Adjusted splits info */}
                        {occ.recalculatedSplits && (
                          <div className="mt-2 p-2 bg-sky-500/5 rounded-lg border border-sky-500/10 text-[11px] text-sky-300">
                            <span className="font-semibold">Equal split recalculated:</span> Bob or another participant left this group. Splits re-pro-rated among remaining active members.
                          </div>
                        )}

                        {/* Validation Error banner */}
                        {occ.validationError && (
                          <div className="mt-2 p-2 bg-amber-500/10 rounded-lg border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-1.5">
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold">Split conflict:</span> {occ.validationError}
                              <p className="text-[10px] text-amber-400/80 mt-0.5">Please manually fix and edit the participant splits below to approve.</p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleSkipOccurrence(occ)}
                        >
                          Skip
                        </Button>
                        
                        {occ.validationError ? (
                          <Button
                            variant="gradient"
                            size="sm"
                            onClick={() => setEditingOccurrence(occ)}
                            className="bg-amber-600 hover:bg-amber-700"
                          >
                            Resolve & Approve
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleApproveOccurrence(occ)}
                          >
                            Approve
                          </Button>
                        )}
                      </div>
                    </GlassPanel>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Active recurring templates */}
          <div>
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-2 mb-3">
              <Repeat className="h-4 w-4 text-accent-indigo" />
              Recurring Templates ({templates.length})
            </h3>

            {templates.length === 0 ? (
              <GlassPanel variant="subtle" className="text-center py-8 text-xs text-text-muted">
                No active recurring templates defined. Set up a rent or subscription template to automate split generation.
              </GlassPanel>
            ) : (
              <div className="flex flex-col gap-4">
                {templates.map((temp) => (
                  <GlassPanel
                    key={temp.id}
                    variant="standard"
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="p-3 rounded-lg bg-surface-elevated text-accent-indigo">
                        <Repeat className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-text-primary leading-tight truncate">
                          {temp.title}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-text-muted">
                          <span className="capitalize">{temp.schedule.frequency} subscription</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            Next due: {temp.nextOccurrenceDate}
                          </span>
                          <span>•</span>
                          <span>Split: <span className="capitalize">{temp.splitMethod}</span></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-5 border-t sm:border-none pt-3 sm:pt-0 border-white/5">
                      <div className="text-left sm:text-right">
                        <span className="text-base font-bold text-text-primary financial-number">
                          {formatCurrency(temp.amountMinor, temp.currency)}
                        </span>
                        <p className="text-[10px] text-text-muted mt-0.5">Template value</p>
                      </div>

                      {/* Active status pause/resume switch */}
                      <button
                        onClick={() => handleToggleTemplate(temp)}
                        className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-accent-cyan ${
                          temp.status === "active" ? "bg-accent-indigo" : "bg-white/10"
                        }`}
                        aria-label={`Toggle active status for ${temp.title}`}
                      >
                        <div
                          className={`h-5 w-5 rounded-full bg-text-primary shadow-sm transform transition-transform ${
                            temp.status === "active" ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </GlassPanel>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE TEMPLATE FORM MODAL */}
      {isCreateOpen && (
        <CreateTemplateModal
          groupId={selectedGroupId}
          members={members}
          onClose={() => setIsCreateOpen(false)}
          onSubmit={async (payload: any) => {
            try {
              const clientOperationId = `op-create-temp-${Date.now()}`;
              const fullPayload = {
                clientOperationId,
                groupId: selectedGroupId,
                ...payload,
              };

              if (syncStatus.isOnline) {
                toast.loading("Creating recurring template...", { id: "create-toast" });
                const { httpsCallable } = await import("firebase/functions");
                const { functions } = await import("../../../src/infrastructure/firebase/firebase");
                const createFn = httpsCallable<any, any>(functions, "createRecurringTemplate");
                await createFn(fullPayload);
                toast.success("Recurring template created!", { id: "create-toast" });
              } else {
                await syncManager.queueCreateRecurringTemplate(selectedGroupId, fullPayload);
                toast.info("Offline: Template queued in outbox.", { id: "create-toast" });
              }
              setIsCreateOpen(false);
            } catch (err: any) {
              toast.error(err.message || "Failed to create recurring template.", { id: "create-toast" });
            }
          }}
        />
      )}

      {/* EDIT SPLITS MODAL (RESOLVE CONFLICT AND APPROVE) */}
      {editingOccurrence && (
        <EditSplitsModal
          occurrence={editingOccurrence}
          template={getTemplate(editingOccurrence.templateId)!}
          members={members}
          onClose={() => setEditingOccurrence(null)}
          onSubmit={async (adjustedPayload: any) => {
            await handleApproveOccurrence(editingOccurrence, adjustedPayload);
          }}
        />
      )}
    </PageContainer>
  );
};

// ----------------------------------------------------
// CREATE TEMPLATE MODAL COMPONENT
// ----------------------------------------------------
interface CreateTemplateModalProps {
  groupId: string;
  members: any[];
  onClose: () => void;
  onSubmit: (payload: any) => void;
}

const CreateTemplateModal: React.FC<CreateTemplateModalProps> = ({
  members,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("utilities");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [splitMethod, setSplitMethod] = useState<SplitMethod>("equal");

  // Schedule settings
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");
  const [interval, setIntervalVal] = useState("1");
  const [startLocalDate, setStartLocalDate] = useState("");
  const [timeZone, setTimeZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");

  const [payers, setPayers] = useState<{ memberId: string; amountMinor: number }[]>([]);
  const [splits, setSplits] = useState<{ memberId: string; amountMinor: number }[]>([]);

  useEffect(() => {
    // Initial splits set
    if (members.length > 0) {
      setPayers([{ memberId: members[0].id, amountMinor: 0 }]);
      setSplits(members.map((m) => ({ memberId: m.id, amountMinor: 0 })));
    }
  }, [members]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amount || !startLocalDate) {
      toast.error("Please fill out all required fields.");
      return;
    }

    const amountMinor = Math.round(parseFloat(amount) * 100);
    const payersPayload = payers.map((p) => ({
      memberId: p.memberId,
      amountMinor: splitMethod === "equal" ? amountMinor : p.amountMinor,
    }));

    // Equal split calculations pro-rata
    let splitsPayload = splits;
    if (splitMethod === "equal") {
      const activeIds = splits.map((s) => s.memberId);
      const splitVal = Math.floor(amountMinor / activeIds.length);
      const remainder = amountMinor % activeIds.length;
      splitsPayload = activeIds.map((id, index) => ({
        memberId: id,
        amountMinor: splitVal + (index < remainder ? 1 : 0),
      }));
    }

    onSubmit({
      templateId: `temp-${Date.now()}`,
      title,
      notes,
      category,
      amountMinor,
      currency,
      fxNumerator: 1,
      fxDenominator: 1,
      splitMethod,
      payers: payersPayload,
      splits: splitsPayload,
      schedule: {
        frequency,
        interval: parseInt(interval) || 1,
        startLocalDate,
      },
      timeZone,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <GlassPanel variant="standard" className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto text-left">
        <h3 className="text-base font-bold text-text-primary flex items-center gap-2 mb-4">
          <Repeat className="h-5 w-5 text-accent-indigo" />
          Create Recurring Template
        </h3>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Broadband Subscription"
              className="w-full px-3 py-2 bg-surface-primary border border-white/10 rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-cyan"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Monthly broadband split"
              className="w-full px-3 py-2 bg-surface-primary border border-white/10 rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-cyan"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3 py-2 bg-surface-primary border border-white/10 rounded-lg text-sm text-text-primary focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Currency *</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 bg-surface-primary border border-white/10 rounded-lg text-sm text-text-primary focus:outline-none"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="INR">INR (₹)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Amount *</label>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-surface-primary border border-white/10 rounded-lg text-sm text-text-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Split Method</label>
              <select
                value={splitMethod}
                onChange={(e) => setSplitMethod(e.target.value as any)}
                className="w-full px-3 py-2 bg-surface-primary border border-white/10 rounded-lg text-sm text-text-primary focus:outline-none"
              >
                <option value="equal">Split Equally</option>
                <option value="exact">Exact Amounts</option>
              </select>
            </div>
          </div>

          {/* Schedule parameters */}
          <div className="grid grid-cols-3 gap-3 border-t border-white/5 pt-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Frequency</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as any)}
                className="w-full px-3 py-2 bg-surface-primary border border-white/10 rounded-lg text-xs text-text-primary focus:outline-none"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Interval</label>
              <input
                type="number"
                min="1"
                required
                value={interval}
                onChange={(e) => setIntervalVal(e.target.value)}
                className="w-full px-3 py-2 bg-surface-primary border border-white/10 rounded-lg text-xs text-text-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Start Date *</label>
              <input
                type="date"
                required
                value={startLocalDate}
                onChange={(e) => setStartLocalDate(e.target.value)}
                className="w-full px-3 py-2 bg-surface-primary border border-white/10 rounded-lg text-xs text-text-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Timezone</label>
            <input
              type="text"
              required
              value={timeZone}
              onChange={(e) => setTimeZone(e.target.value)}
              className="w-full px-3 py-2 bg-surface-primary border border-white/10 rounded-lg text-xs text-text-primary focus:outline-none"
            />
          </div>

          {/* Payer Configuration */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Paid By</label>
            <select
              value={payers[0]?.memberId || ""}
              onChange={(e) => setPayers([{ memberId: e.target.value, amountMinor: 0 }])}
              className="w-full px-3 py-2 bg-surface-primary border border-white/10 rounded-lg text-sm text-text-primary focus:outline-none"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.displayName}</option>
              ))}
            </select>
          </div>

          {/* Exact amount splits listing if splitMethod is exact */}
          {splitMethod === "exact" && (
            <div className="border-t border-white/5 pt-3">
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Participant Splits</label>
              <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                {splits.map((s, idx) => {
                  const m = members.find((x) => x.id === s.memberId);
                  return (
                    <div key={s.memberId} className="flex items-center justify-between gap-3 text-xs">
                      <span>{m?.displayName || "Participant"}</span>
                      <input
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        onChange={(e) => {
                          const val = Math.round(parseFloat(e.target.value) * 100) || 0;
                          const newSplits = [...splits];
                          newSplits[idx].amountMinor = val;
                          setSplits(newSplits);
                        }}
                        className="w-24 px-2 py-1 bg-surface-primary border border-white/10 rounded text-right"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end border-t border-white/5 pt-4">
            <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
            <Button variant="gradient" type="submit">Create Template</Button>
          </div>
        </form>
      </GlassPanel>
    </div>
  );
};

// ----------------------------------------------------
// EDIT SPLITS MODAL (RESOLVE CONFLICT AND APPROVE)
// ----------------------------------------------------
interface EditSplitsModalProps {
  occurrence: RecurringOccurrenceDocument;
  template: RecurringTemplateDocument;
  members: any[];
  onClose: () => void;
  onSubmit: (adjustedPayload: any) => void;
}

const EditSplitsModal: React.FC<EditSplitsModalProps> = ({
  occurrence: _occurrence,
  template,
  members,
  onClose,
  onSubmit,
}) => {
  const [splits, setSplits] = useState<{ memberId: string; amountMinor: number }[]>([]);

  useEffect(() => {
    // Populate active members
    setSplits(members.map((m) => ({ memberId: m.id, amountMinor: 0 })));
  }, [members]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sum = splits.reduce((acc, s) => acc + s.amountMinor, 0);
    if (sum !== template.amountMinor) {
      toast.error(`Total split amount (${formatCurrency(sum, template.currency)}) does not match template value (${formatCurrency(template.amountMinor, template.currency)}).`);
      return;
    }

    onSubmit({
      adjustedSplits: splits.map((s) => ({
        memberId: s.memberId,
        amountMinor: s.amountMinor,
      })),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <GlassPanel variant="standard" className="w-full max-w-md p-6 text-left">
        <h3 className="text-sm font-bold text-text-primary flex items-center gap-2 mb-1.5">
          <AlertCircle className="h-5 w-5 text-amber-400" />
          Resolve Splits & Approve Draft
        </h3>
        <p className="text-[11px] text-text-muted mb-4">
          Because one or more original participants left the group, you must manually repair the split configuration for this cycle to confirm.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="p-3 bg-white/5 rounded-lg text-xs text-text-secondary">
            <span className="font-semibold">Template amount:</span> {formatCurrency(template.amountMinor, template.currency)}
          </div>

          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
            {splits.map((s, idx) => {
              const m = members.find((x) => x.id === s.memberId);
              return (
                <div key={s.memberId} className="flex items-center justify-between gap-3 text-xs">
                  <span>{m?.displayName || "Participant"}</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      onChange={(e) => {
                        const val = Math.round(parseFloat(e.target.value) * 100) || 0;
                        const newSplits = [...splits];
                        newSplits[idx].amountMinor = val;
                        setSplits(newSplits);
                      }}
                      className="w-24 px-2 py-1.5 bg-surface-primary border border-white/10 rounded text-right"
                    />
                    <span className="text-text-muted">{template.currency}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 justify-end border-t border-white/5 pt-4">
            <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
            <Button variant="gradient" type="submit">Submit & Approve</Button>
          </div>
        </form>
      </GlassPanel>
    </div>
  );
};

export default RecurringPage;
