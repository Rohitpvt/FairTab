import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog } from "../../components/ui/Dialogs";
import { Button } from "../../components/ui/Button";
import { groupService } from "../../infrastructure/firebase/groupService";
import { toast } from "sonner";

interface LeaveGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  activeMemberUserIds: string[];
  groupVersion: number;
}

export const LeaveGroupDialog: React.FC<LeaveGroupDialogProps> = ({
  isOpen,
  onClose,
  groupId,
  groupName,
  activeMemberUserIds,
  groupVersion,
}) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleLeave = async () => {
    setIsLoading(true);
    try {
      await groupService.leaveGroup(groupId, activeMemberUserIds, groupVersion);
      toast.success(`You have left the group "${groupName}".`);
      onClose();
      navigate("/groups");
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast.error(err.message || "Failed to leave group.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={(open) => !open && onClose()} title="Leave Group">
      <div className="flex flex-col gap-4 text-left">
        <p className="text-sm text-text-secondary leading-relaxed">
          Are you sure you want to leave the group <span className="font-semibold text-text-primary">"{groupName}"</span>?
        </p>
        <p className="text-xs text-text-muted leading-relaxed">
          You will lose access to shared balances, transactions, and group notifications. Historical split ledgers will retain your name.
        </p>

        <div className="flex gap-3 mt-4">
          <Button variant="ghost" onClick={onClose} className="flex-1" disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleLeave} variant="ghost" className="flex-1 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20" isLoading={isLoading}>
            Leave Group
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

export default LeaveGroupDialog;
