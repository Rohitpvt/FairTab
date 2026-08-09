import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as zod from "zod";
import { Dialog } from "../../components/ui/Dialogs";
import { Button } from "../../components/ui/Button";
import { groupService } from "../../infrastructure/firebase/groupService";
import { toast } from "sonner";

interface AddPlaceholderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupVersion: number;
}

const placeholderSchema = zod.object({
  displayName: zod
    .string()
    .min(1, "Display name is required.")
    .max(50, "Display name must be 50 characters or less."),
});

type PlaceholderFormData = zod.infer<typeof placeholderSchema>;

export const AddPlaceholderDialog: React.FC<AddPlaceholderDialogProps> = ({
  isOpen,
  onClose,
  groupId,
  groupVersion,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PlaceholderFormData>({
    resolver: zodResolver(placeholderSchema),
    defaultValues: {
      displayName: "",
    },
  });

  const onSubmit = async (data: PlaceholderFormData) => {
    setIsLoading(true);
    try {
      await groupService.addPlaceholderMember(groupId, data.displayName.trim(), groupVersion);
      toast.success(`Placeholder member "${data.displayName}" added successfully!`);
      handleClose();
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast.error(err.message || "Failed to add placeholder member.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={(open) => !open && handleClose()} title="Add Placeholder Member">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 text-left">
        <p className="text-xs text-text-secondary leading-relaxed">
          Create a temporary member (e.g. for split calculation purposes). Placeholders do not have emails or logins, and cannot access FairTab.
        </p>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pl-name" className="text-xs font-semibold text-text-secondary">
            Display Name
          </label>
          <input
            id="pl-name"
            type="text"
            {...register("displayName")}
            placeholder="e.g. John Doe (Offline)"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan transition-colors"
          />
          {errors.displayName && (
            <span className="text-xs text-danger font-medium mt-0.5">{errors.displayName.message}</span>
          )}
        </div>

        <div className="flex gap-3 mt-2">
          <Button type="button" variant="ghost" onClick={handleClose} className="flex-1" disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="gradient" className="flex-1" isLoading={isLoading}>
            Add Member
          </Button>
        </div>
      </form>
    </Dialog>
  );
};

export default AddPlaceholderDialog;
