import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog } from "../../components/ui/Dialogs";
import { Button } from "../../components/ui/Button";
import { groupService } from "../../infrastructure/firebase/groupService";
import { toast } from "sonner";

interface ArchiveGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  groupVersion: number;
}

export const ArchiveGroupDialog: React.FC<ArchiveGroupDialogProps> = ({
  isOpen,
  onClose,
  groupId,
  groupName,
  groupVersion,
}) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleArchive = async () => {
    setIsLoading(true);
    try {
      await groupService.archiveGroup(groupId, groupVersion);
      toast.success(`Group "${groupName}" archived successfully.`);
      onClose();
      navigate("/groups");
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast.error(err.message || "Failed to archive group.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={(open) => !open && onClose()} title="Archive Group">
      <div className="flex flex-col gap-4 text-left">
        <p className="text-sm text-text-secondary leading-relaxed">
          Are you sure you want to archive the group <span className="font-semibold text-text-primary">"{groupName}"</span>?
        </p>
        <p className="text-xs text-text-muted leading-relaxed">
          Archiving makes the group read-only for all members. You can view history and ledger logs, but no new expenses can be split.
        </p>

        <div className="flex gap-3 mt-4">
          <Button variant="ghost" onClick={onClose} className="flex-1" disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleArchive} variant="gradient" className="flex-1" isLoading={isLoading}>
            Archive Group
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

export default ArchiveGroupDialog;
