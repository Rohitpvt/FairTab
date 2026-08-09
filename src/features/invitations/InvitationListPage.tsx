import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Check, X, Share2 } from "lucide-react";
import { PageContainer } from "../../components/layout/PageContainer";
import { invitationService } from "../../infrastructure/firebase/invitationService";
import type { InvitationDocument } from "./invitationSchema";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/feedback/FeedbackStates";
import { toast } from "sonner";

export const InvitationListPage: React.FC = () => {
  const navigate = useNavigate();
  const [invitations, setInvitations] = useState<InvitationDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const isOffline = !navigator.onLine;
  const [now] = useState(() => Date.now());

  useEffect(() => {
    const unsubscribe = invitationService.watchReceivedInvitations((data) => {
      setInvitations(data);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAccept = async (inviteId: string, groupName: string) => {
    if (isOffline) {
      toast.error("A connection is required for this membership change.");
      return;
    }
    setProcessingId(inviteId);
    try {
      await invitationService.acceptInvitation(inviteId);
      toast.success(`Joined group "${groupName}"!`);
      navigate("/groups");
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      toast.error(err.message || "Failed to accept invitation.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (inviteId: string) => {
    if (isOffline) {
      toast.error("A connection is required for this membership change.");
      return;
    }
    setProcessingId(inviteId);
    try {
      await invitationService.declineInvitation(inviteId);
      toast.success("Invitation declined.");
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      toast.error(err.message || "Failed to decline invitation.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleCopyLink = (inviteId: string) => {
    const url = `${window.location.origin}${window.location.pathname}#/invitations/${inviteId}`;
    navigator.clipboard.writeText(url);
    toast.success("Invitation link copied to clipboard!");
  };

  if (isLoading) {
    return (
      <PageContainer title="Invitations" description="Checking for pending group invitations...">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Invitations"
      description="Accept or decline pending invitations to join shared split ledger groups."
    >
      {invitations.length === 0 ? (
        <EmptyState
          title="No Pending Invitations"
          description="Any shared group invitations sent to your email address will display here."
          icon={<Mail className="h-8 w-8 text-accent-indigo" />}
        />
      ) : (
        <div className="max-w-xl mx-auto flex flex-col gap-4">
          {invitations.map((invite) => {
            const isProcessing = processingId === invite.id;
            const expiresAtTs = invite.expiresAt as { toDate?: () => Date; seconds?: number } | null | undefined;
            const expiresDate = expiresAtTs?.toDate
              ? expiresAtTs.toDate()
              : expiresAtTs?.seconds
              ? new Date(expiresAtTs.seconds * 1000)
              : new Date();
            const isExpired = expiresDate.getTime() < now;

            return (
              <div
                key={invite.id}
                className="glass-elevated border border-white/10 rounded-2xl p-6 text-left flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all duration-300 hover:border-white/20"
              >
                {/* Details */}
                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-bold text-text-primary">
                    {invite.groupName}
                  </h3>
                  <p className="text-xs text-text-muted">
                    Invited as <span className="capitalize font-semibold text-accent-cyan">{invite.proposedRole}</span>
                  </p>
                  <span className="text-[10px] text-text-muted mt-1">
                    Expires: {expiresDate.toLocaleDateString()} {isExpired && <span className="text-danger font-semibold">(Expired)</span>}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 w-full sm:w-auto self-end sm:self-auto">
                  <Button
                    onClick={() => handleCopyLink(invite.id)}
                    variant="ghost"
                    size="sm"
                    className="p-2.5 text-text-muted hover:text-text-primary rounded-xl"
                    title="Copy Link"
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => handleDecline(invite.id)}
                    variant="ghost"
                    size="sm"
                    className="flex-1 sm:flex-initial text-danger hover:bg-danger/5 border border-white/10 rounded-xl"
                    disabled={isProcessing || isExpired}
                  >
                    <X className="h-4 w-4 mr-1.5" />
                    Decline
                  </Button>
                  <Button
                    onClick={() => handleAccept(invite.id, invite.groupName)}
                    variant="gradient"
                    size="sm"
                    className="flex-1 sm:flex-initial rounded-xl"
                    disabled={isProcessing || isExpired}
                  >
                    <Check className="h-4 w-4 mr-1.5" />
                    Accept
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
};

export default InvitationListPage;
