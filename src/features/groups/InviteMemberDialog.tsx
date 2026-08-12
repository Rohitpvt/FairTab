import React, { useState } from "react";
import { Copy, Check, ShieldAlert } from "lucide-react";
import { Dialog } from "../../components/ui/Dialogs";
import { Button } from "../../components/ui/Button";
import { fairtabApi } from "../../infrastructure/api/fairtabApi";
import { toast } from "sonner";

interface InviteMemberDialogProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
}

type TabType = "email" | "global";

export const InviteMemberDialog: React.FC<InviteMemberDialogProps> = ({
  isOpen,
  onClose,
  groupId,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("email");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Email form states
  const [email, setEmail] = useState("");
  const [emailRole, setEmailRole] = useState<"admin" | "member" | "viewer">("member");

  // Global link states
  const [globalRole, setGlobalRole] = useState<"admin" | "member" | "viewer">("member");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [generatedLinkId, setGeneratedLinkId] = useState<string | null>(null);

  const handleSendEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setIsLoading(true);
    try {
      await fairtabApi.invitations.createEmail({
        groupId,
        email,
        role: emailRole,
      });
      toast.success(`Invitation successfully sent to ${email}!`);
      setEmail("");
    } catch (error: any) {
      toast.error(error.message || "Failed to send email invitation.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateGlobalLink = async () => {
    setIsLoading(true);
    setGeneratedLink(null);
    try {
      const res: any = await fairtabApi.invitations.createGlobal({
        groupId,
        role: globalRole,
      });
      const link = `${window.location.origin}${window.location.pathname}#/join/${res.token}`;
      setGeneratedLink(link);
      setGeneratedLinkId(res.linkId);
      toast.success("Global invite link created successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to create global invite link.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeGlobalLink = async () => {
    if (!generatedLinkId) return;
    setIsLoading(true);
    try {
      await fairtabApi.invitations.revokeGlobal({
        linkId: generatedLinkId,
      });
      setGeneratedLink(null);
      setGeneratedLinkId(null);
      toast.success("Global invite link revoked successfully.");
    } catch (error: any) {
      toast.error(error.message || "Failed to revoke link.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setEmail("");
    setGeneratedLink(null);
    setGeneratedLinkId(null);
    onClose();
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={(open) => !open && handleClose()} title="Invite Group Member">
      <div className="flex flex-col gap-5 text-left w-full mt-2">
        {/* Navigation Tabs */}
        <div className="flex border-b border-white/10 w-full">
          <button
            type="button"
            onClick={() => {
              setActiveTab("email");
              setGeneratedLink(null);
            }}
            className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "email"
                ? "border-accent-cyan text-accent-cyan"
                : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            Invite by Email
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("global")}
            className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "global"
                ? "border-accent-cyan text-accent-cyan"
                : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            Share Invite Link
          </button>
        </div>

        {/* Tab Content: Invite by Email */}
        {activeTab === "email" && (
          <form onSubmit={handleSendEmailInvite} className="flex flex-col gap-4">
            <p className="text-xs text-text-secondary leading-relaxed">
              Send a personalized invitation directly. The invitee will join the group immediately upon accepting from their registered email.
            </p>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="invite-email-input" className="text-xs font-semibold text-text-secondary">
                Email Address
              </label>
              <input
                id="invite-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="friend@example.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="invite-role-input" className="text-xs font-semibold text-text-secondary">
                Proposed Role
              </label>
              <select
                id="invite-role-input"
                value={emailRole}
                onChange={(e) => setEmailRole(e.target.value as any)}
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
                Send Invitation
              </Button>
            </div>
          </form>
        )}

        {/* Tab Content: Share Invite Link */}
        {activeTab === "global" && (
          <div className="flex flex-col gap-4">
            {!generatedLink ? (
              <>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Generate a reusable global invitation link. Anyone who clicks this link can request to join, subject to admin approval.
                </p>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="global-role-input" className="text-xs font-semibold text-text-secondary">
                    Role for Joiners
                  </label>
                  <select
                    id="global-role-input"
                    value={globalRole}
                    onChange={(e) => setGlobalRole(e.target.value as any)}
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
                  <Button onClick={handleCreateGlobalLink} variant="gradient" className="flex-1" isLoading={isLoading}>
                    Create Invite Link
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2 p-4 bg-success/5 border border-success/20 rounded-xl">
                  <span className="text-sm font-semibold text-text-primary">Global Link Ready!</span>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Copy and share this link. Recipient requests must be approved by a group Owner or Admin.
                  </p>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedLink}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-text-secondary focus:outline-none font-mono"
                  />
                  <Button onClick={handleCopyLink} variant="secondary" className="px-3">
                    {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>

                <div className="flex gap-3 mt-2">
                  <Button onClick={handleRevokeGlobalLink} variant="danger" className="flex-1 gap-2" isLoading={isLoading}>
                    <ShieldAlert className="h-4 w-4" /> Revoke Link
                  </Button>
                  <Button onClick={handleClose} variant="ghost" className="flex-1" disabled={isLoading}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
};

export default InviteMemberDialog;
