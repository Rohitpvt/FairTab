import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Check, Info } from "lucide-react";
import { Dialog } from "../../components/ui/Dialogs";
import { Button } from "../../components/ui/Button";
import { invitationSchema } from "../invitations/invitationSchema";
import type { InvitationFormData } from "../invitations/invitationSchema";
import { invitationService } from "../../infrastructure/firebase/invitationService";
import { toast } from "sonner";

interface InviteMemberDialogProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
}

export const InviteMemberDialog: React.FC<InviteMemberDialogProps> = ({
  isOpen,
  onClose,
  groupId,
  groupName,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<InvitationFormData>({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      email: "",
      proposedRole: "member",
    },
  });

  const onSubmit = async (data: InvitationFormData) => {
    setIsLoading(true);
    setInviteUrl(null);
    try {
      const inviteId = await invitationService.createInvitation(groupId, groupName, data);
      const url = `${window.location.origin}${window.location.pathname}#/invitations/${inviteId}`;
      setInviteUrl(url);
      toast.success("Invitation created successfully!");
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast.error(err.message || "Failed to create invitation.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    reset();
    setInviteUrl(null);
    onClose();
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={(open) => !open && handleClose()} title="Invite Group Member">
      <div className="flex flex-col gap-4 text-left">
        {!inviteUrl ? (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <p className="text-xs text-text-secondary leading-relaxed">
              Create an invitation link for a friend to join this group. Email delivery is currently deferred; you must copy and share the link manually.
            </p>

            {/* Email Address */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="inv-email" className="text-xs font-semibold text-text-secondary">
                Email Address
              </label>
              <input
                id="inv-email"
                type="email"
                {...register("email")}
                placeholder="friend@example.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan transition-colors"
              />
              {errors.email && (
                <span className="text-xs text-danger font-medium mt-0.5">{errors.email.message}</span>
              )}
            </div>

            {/* Proposed Role */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="inv-role" className="text-xs font-semibold text-text-secondary">
                Proposed Role
              </label>
              <select
                id="inv-role"
                {...register("proposedRole")}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-cyan transition-colors [&>option]:bg-[#0c0f1d]"
              >
                <option value="member">Member (Can split expenses)</option>
                <option value="admin">Admin (Can manage members)</option>
                <option value="viewer">Viewer (Read-only)</option>
              </select>
            </div>

            <div className="flex gap-3 mt-2">
              <Button type="button" variant="ghost" onClick={handleClose} className="flex-1" disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" variant="gradient" className="flex-1" isLoading={isLoading}>
                Create Link
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 p-4 bg-success/5 border border-success/20 rounded-xl">
              <span className="text-sm font-semibold text-text-primary">Invitation Created!</span>
              <p className="text-xs text-text-secondary leading-relaxed">
                Send this link to your friend. They must verify their email address before joining.
              </p>
            </div>

            {/* URL Display Box */}
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-text-secondary focus:outline-none font-mono"
              />
              <Button onClick={handleCopyLink} variant="secondary" className="px-3">
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            <div className="flex items-center gap-2 p-3 bg-white/[0.02] border border-white/5 rounded-lg text-[10px] text-text-muted">
              <Info className="h-3.5 w-3.5 text-accent-indigo shrink-0" />
              <span>Email delivery deferred. Copy and send link manually.</span>
            </div>

            <Button onClick={handleClose} variant="ghost" className="w-full mt-2">
              Close
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
};
export default InviteMemberDialog;
