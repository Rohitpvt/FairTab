/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog } from "../../components/ui/Dialogs";
import { Button } from "../../components/ui/Button";
import { groupService } from "../../infrastructure/firebase/groupService";
import { toast } from "sonner";

interface DeleteGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
}

export const DeleteGroupDialog: React.FC<DeleteGroupDialogProps> = ({
  isOpen,
  onClose,
  groupId,
  groupName,
}) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [typedName, setTypedName] = useState("");

  const handleDelete = async () => {
    if (typedName.trim() !== groupName.trim()) {
      toast.error("Group name confirmation does not match.");
      return;
    }

    setIsLoading(true);
    const toastId = toast.loading(`Soft-deleting group "${groupName}"...`);
    try {
      // Perform idempotent paging delete call until completed
      let res: any = await groupService.deleteGroup({ groupId });
      while (res.status === "processing") {
        toast.loading(`Processing member index cleanups (cleaned: ${res.processedCount})...`, { id: toastId });
        res = await groupService.deleteGroup({ groupId });
      }

      toast.success(`Group "${groupName}" soft-deleted successfully.`, { id: toastId });
      onClose();
      navigate("/groups");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to delete group.", { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={(open) => !open && onClose()} title="Delete Group Permanently?">
      <div className="flex flex-col gap-4 text-left">
        <p className="text-sm text-text-secondary leading-relaxed">
          Are you sure you want to delete the group <span className="font-semibold text-text-primary">"{groupName}"</span>?
        </p>
        <p className="text-xs text-text-muted leading-relaxed">
          This operation will lock all splits and make the group completely inaccessible. Historical logs will be preserved but no further mutations will be allowed.
        </p>

        <div className="flex flex-col gap-2 mt-2">
          <label htmlFor="confirm-name-in" className="text-xs font-semibold text-text-secondary">
            Type group name <span className="text-text-primary font-bold">"{groupName}"</span> to confirm:
          </label>
          <input
            id="confirm-name-in"
            type="text"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder="Enter group name"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan"
            disabled={isLoading}
          />
        </div>

        <div className="flex gap-3 mt-4">
          <Button variant="ghost" onClick={onClose} className="flex-1" disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            className="flex-1 bg-danger text-text-primary hover:bg-opacity-95 border-none"
            isLoading={isLoading}
            disabled={typedName.trim() !== groupName.trim()}
          >
            Delete Group
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

export default DeleteGroupDialog;
