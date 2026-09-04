/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { Dialog } from "../../components/ui/Dialogs";
import { Button } from "../../components/ui/Button";
import { groupService } from "../../infrastructure/firebase/groupService";
import type { GroupDocument } from "../groups/groupSchema";
import type { GroupMemberDocument } from "../groups/memberSchema";
import { AlertCircle, CheckCircle2, Shield, Trash2, ArrowRight, UserCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export interface GroupResolutionItem {
  group: GroupDocument;
  members: GroupMemberDocument[];
  eligibleSuccessors: GroupMemberDocument[];
  action: "transfer" | "delete" | "none";
  selectedSuccessorId: string;
  status: "needs_action" | "transfer_selected" | "delete_selected" | "completed" | "failed";
  errorMessage?: string;
}

interface AccountGroupResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onResolved: () => void;
}

export const AccountGroupResolutionModal: React.FC<AccountGroupResolutionModalProps> = ({
  isOpen,
  onClose,
  userId,
  onResolved,
}) => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<GroupResolutionItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmationStep, setShowConfirmationStep] = useState(false);

  // Load owned groups and their active members
  useEffect(() => {
    if (!isOpen || !userId) return;

    let isMounted = true;
    setLoading(true);
    setShowConfirmationStep(false);

    const loadOwnedGroups = async () => {
      try {
        const owned = await groupService.fetchOwnedGroups(userId);
        const resolvedItems: GroupResolutionItem[] = [];

        for (const grp of owned) {
          try {
            const members = await groupService.fetchGroupMembers(grp.id);
            // Eligible successors: active, kind == "account", userId exists, userId != current owner
            const eligibleSuccessors = members.filter(
              (m) =>
                m.status === "active" &&
                m.kind === "account" &&
                !!m.userId &&
                m.userId !== userId
            );

            resolvedItems.push({
              group: grp,
              members,
              eligibleSuccessors,
              action: eligibleSuccessors.length > 0 ? "transfer" : "delete",
              selectedSuccessorId: eligibleSuccessors.length > 0 ? eligibleSuccessors[0].id : "",
              status: eligibleSuccessors.length > 0 ? "transfer_selected" : "delete_selected",
            });
          } catch (err: any) {
            console.error(`Failed to load members for group ${grp.id}`, err);
            resolvedItems.push({
              group: grp,
              members: [],
              eligibleSuccessors: [],
              action: "delete",
              selectedSuccessorId: "",
              status: "delete_selected",
            });
          }
        }

        if (isMounted) {
          setItems(resolvedItems);
          setLoading(false);
        }
      } catch (err: any) {
        console.error("Failed to load owned groups", err);
        toast.error("Failed to load owned groups. Please try again.");
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadOwnedGroups();

    return () => {
      isMounted = false;
    };
  }, [isOpen, userId]);

  const handleActionChange = (groupId: string, action: "transfer" | "delete") => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.group.id !== groupId) return item;

        let status: GroupResolutionItem["status"] = "needs_action";
        if (action === "transfer") {
          status = item.selectedSuccessorId ? "transfer_selected" : "needs_action";
        } else if (action === "delete") {
          status = "delete_selected";
        }

        return {
          ...item,
          action,
          status: item.status === "completed" ? "completed" : status,
          errorMessage: undefined,
        };
      })
    );
  };

  const handleSuccessorChange = (groupId: string, memberId: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.group.id !== groupId) return item;
        return {
          ...item,
          selectedSuccessorId: memberId,
          status: memberId ? "transfer_selected" : "needs_action",
          errorMessage: undefined,
        };
      })
    );
  };

  const allConfigured = items.every((item) => {
    if (item.status === "completed") return true;
    if (item.action === "delete") return true;
    if (item.action === "transfer") return !!item.selectedSuccessorId;
    return false;
  });

  const allCompleted = items.length > 0 && items.every((item) => item.status === "completed");

  const handleExecuteResolutions = async () => {
    setIsProcessing(true);
    let hasFailure = false;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.status === "completed") continue;

      try {
        if (item.action === "transfer") {
          if (!item.selectedSuccessorId) {
            throw new Error("No successor selected.");
          }
          await groupService.transferOwnership(item.group.id, item.selectedSuccessorId);
        } else if (item.action === "delete") {
          let res: any = await groupService.deleteGroup({ groupId: item.group.id });
          while (res && res.status === "processing") {
            res = await groupService.deleteGroup({ groupId: item.group.id });
          }
        }

        // Mark this group completed
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i ? { ...it, status: "completed", errorMessage: undefined } : it
          )
        );
      } catch (err: any) {
        hasFailure = true;
        const msg = err.message || "Operation failed.";
        console.error(`Resolution error for group ${item.group.name}:`, err);
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i ? { ...it, status: "failed", errorMessage: msg } : it
          )
        );
        toast.error(`Failed to resolve "${item.group.name}": ${msg}`);
        break; // Stop immediately to avoid partial-unverified progression
      }
    }

    setIsProcessing(false);

    if (!hasFailure) {
      toast.success("All owned groups successfully resolved!");
      onResolved();
    }
  };

  if (loading) {
    return (
      <Dialog
        isOpen={isOpen}
        onOpenChange={(open) => !open && !isProcessing && onClose()}
        title="Review Group Ownership"
      >
        <div className="flex flex-col items-center justify-center p-8 gap-3">
          <div className="h-7 w-7 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-text-muted">Analyzing owned groups and memberships...</p>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => !open && !isProcessing && onClose()}
      title="Resolve Group Ownership Before Account Deletion"
      description="You own active or archived groups. Choose whether to transfer ownership or delete each group to prevent orphaned ledgers."
      className="max-w-xl"
    >
      <div className="flex flex-col gap-4 text-left">
        {!showConfirmationStep ? (
          <>
            <div className="flex items-start gap-2.5 p-3 bg-accent-cyan/10 border border-accent-cyan/20 rounded-xl text-xs text-text-primary leading-relaxed">
              <Shield className="h-4 w-4 shrink-0 text-accent-cyan mt-0.5" />
              <div>
                To ensure financial integrity, every group you own must either be assigned a new owner or deleted before your profile is deleted.
              </div>
            </div>

            <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto pr-1">
              {items.map((item) => {
                const isCompleted = item.status === "completed";
                const isFailed = item.status === "failed";

                return (
                  <div
                    key={item.group.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isCompleted
                        ? "bg-success/5 border-success/30"
                        : isFailed
                        ? "bg-danger/10 border-danger/40"
                        : "bg-white/[0.03] border-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-text-primary">
                            {item.group.name}
                          </h4>
                          {item.group.status === "archived" && (
                            <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-warning/10 text-warning border border-warning/20">
                              Archived
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-text-muted mt-0.5">
                          {item.members.length} active member(s) • Base Currency: {item.group.baseCurrency}
                        </p>
                      </div>

                      {/* Status indicator */}
                      <div>
                        {isCompleted && (
                          <span className="flex items-center gap-1 text-xs text-success font-semibold">
                            <CheckCircle2 className="h-4 w-4" /> Resolved
                          </span>
                        )}
                        {isFailed && (
                          <span className="flex items-center gap-1 text-xs text-danger font-semibold">
                            <AlertCircle className="h-4 w-4" /> Failed
                          </span>
                        )}
                        {!isCompleted && !isFailed && (
                          <span className="text-[11px] font-medium text-text-secondary capitalize px-2 py-0.5 rounded bg-white/5 border border-white/10">
                            {item.status.replace("_", " ")}
                          </span>
                        )}
                      </div>
                    </div>

                    {isFailed && item.errorMessage && (
                      <div className="mb-3 p-2 bg-danger/20 border border-danger/30 rounded-lg text-xs text-danger">
                        {item.errorMessage}
                      </div>
                    )}

                    {!isCompleted && (
                      <div className="flex flex-col gap-2.5 pt-2 border-t border-white/5">
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-1.5 text-xs text-text-primary cursor-pointer">
                            <input
                              type="radio"
                              name={`action-${item.group.id}`}
                              checked={item.action === "transfer"}
                              onChange={() => handleActionChange(item.group.id, "transfer")}
                              disabled={item.eligibleSuccessors.length === 0 || isProcessing}
                              className="accent-accent-cyan"
                            />
                            <span>Transfer Ownership</span>
                          </label>

                          <label className="flex items-center gap-1.5 text-xs text-text-primary cursor-pointer">
                            <input
                              type="radio"
                              name={`action-${item.group.id}`}
                              checked={item.action === "delete"}
                              onChange={() => handleActionChange(item.group.id, "delete")}
                              disabled={isProcessing}
                              className="accent-danger"
                            />
                            <span className="text-danger font-medium">Delete Group</span>
                          </label>
                        </div>

                        {item.action === "transfer" && (
                          <div className="flex flex-col gap-1 mt-1">
                            <label className="text-[11px] font-semibold text-text-secondary">
                              Select New Owner (active account member):
                            </label>
                            {item.eligibleSuccessors.length > 0 ? (
                              <select
                                value={item.selectedSuccessorId}
                                onChange={(e) => handleSuccessorChange(item.group.id, e.target.value)}
                                disabled={isProcessing}
                                className="w-full bg-surface-primary border border-white/10 rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-cyan"
                              >
                                {item.eligibleSuccessors.map((member) => (
                                  <option key={member.id} value={member.id}>
                                    {member.displayName} ({member.role})
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <p className="text-[11px] text-text-muted italic">
                                No eligible account members in this group. You must delete the group to proceed.
                              </p>
                            )}
                          </div>
                        )}

                        {item.action === "delete" && (
                          <div className="flex items-start gap-1.5 text-[11px] text-danger/90 mt-1">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span>This group will be soft-deleted. Ledgers will be locked permanently.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
              <Button
                variant="ghost"
                onClick={onClose}
                disabled={isProcessing}
                size="sm"
              >
                Cancel
              </Button>
              <Button
                variant="gradient"
                onClick={() => setShowConfirmationStep(true)}
                disabled={!allConfigured || isProcessing}
                size="sm"
                className="flex items-center gap-1.5"
              >
                <span>Review & Confirm</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-2.5 p-3 bg-warning/10 border border-warning/20 rounded-xl text-xs text-warning leading-relaxed">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                Please review your resolution plan carefully. Once executed, ownership will transfer and selected groups will be permanently soft-deleted.
              </div>
            </div>

            <div className="flex flex-col gap-2.5 max-h-[45vh] overflow-y-auto">
              {items.map((item) => {
                const successor = item.eligibleSuccessors.find((s) => s.id === item.selectedSuccessorId);
                return (
                  <div
                    key={item.group.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-text-primary">{item.group.name}:</span>
                      {item.action === "transfer" ? (
                        <span className="text-accent-cyan flex items-center gap-1">
                          <UserCheck className="h-3.5 w-3.5" />
                          Transfer to <span className="font-bold underline">{successor?.displayName || "selected member"}</span>
                        </span>
                      ) : (
                        <span className="text-danger flex items-center gap-1 font-semibold">
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete group
                        </span>
                      )}
                    </div>
                    <div>
                      {item.status === "completed" && (
                        <span className="text-success text-[11px] font-bold">Done</span>
                      )}
                      {item.status === "failed" && (
                        <span className="text-danger text-[11px] font-bold">Failed</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
              <Button
                variant="ghost"
                onClick={() => setShowConfirmationStep(false)}
                disabled={isProcessing}
                size="sm"
              >
                Back to Edit
              </Button>
              <Button
                variant="primary"
                onClick={handleExecuteResolutions}
                disabled={isProcessing || allCompleted}
                isLoading={isProcessing}
                loadingText="Executing resolutions..."
                size="sm"
                className="bg-danger text-text-primary hover:bg-opacity-90 border-none"
              >
                Confirm & Continue Account Deletion
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
};
