import React, { useState } from "react";
import { Dialog } from "../../components/ui/Dialogs";
import { Button } from "../../components/ui/Button";
import { groupService } from "../../infrastructure/firebase/groupService";
import { toast } from "sonner";

interface RemoveMemberDialogProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  memberId: string;
  displayName: string;
  kind: "account" | "placeholder";
  activeMemberUserIds: string[];
  groupVersion: number;
}

export const RemoveMemberDialog: React.FC<RemoveMemberDialogProps> = ({
  isOpen,
  onClose,
  groupId,
  memberId,
  displayName,
  kind,
  activeMemberUserIds,
  groupVersion,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleRemove = async () => {
    setIsLoading(true);
    try {
      if (kind === "placeholder") {
        await groupService.removePlaceholderMember(groupId, memberId, displayName, groupVersion);
      } else {
        await groupService.removeAccountMember(groupId, memberId, displayName, activeMemberUserIds, groupVersion);
      }
      toast.success(`Member "${displayName}" has been removed from the group.`);
      onClose();
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast.error(err.message || "Failed to remove member.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={(open) => !open && onClose()} title="Remove Member">
      <div className="flex flex-col gap-4 text-left">
        <p className="text-sm text-text-secondary leading-relaxed">
          Are you sure you want to remove <span className="font-semibold text-text-primary">"{displayName}"</span> from the group?
        </p>
        <p className="text-xs text-text-muted leading-relaxed">
          {kind === "account"
            ? "Their group permissions will be revoked and they will no longer see updates. Historical balances and transactions remain archived in ledgers."
            : "This placeholder will be marked as inactive. Historical records will be preserved."}
        </p>

        <div className="flex gap-3 mt-4">
          <Button variant="ghost" onClick={onClose} className="flex-1" disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleRemove} variant="ghost" className="flex-1 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20" isLoading={isLoading}>
            Remove Member
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

export default RemoveMemberDialog;
