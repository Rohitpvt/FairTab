import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Calendar, UserCheck, AlertTriangle } from "lucide-react";
import { PageContainer } from "../../components/layout/PageContainer";
import { invitationService } from "../../infrastructure/firebase/invitationService";
import type { InvitationDocument } from "./invitationSchema";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import { auth } from "../../infrastructure/firebase/firebase";
import { toast } from "sonner";

export const InvitationAcceptPage: React.FC = () => {
  const { invitationId } = useParams<{ invitationId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [invitation, setInvitation] = useState<InvitationDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentUser = auth.currentUser;
  const isOffline = !navigator.onLine;
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!invitationId) return;

    const fetchInvite = async () => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const invite = await invitationService.getInvitation(invitationId);
        setInvitation(invite);
      } catch (err: unknown) {
        const e = err instanceof Error ? err : new Error(String(err));
        setErrorMsg(e.message || "Failed to fetch invitation details.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvite();
  }, [invitationId]);

  const handleAccept = async () => {
    if (isOffline) {
      toast.error("A connection is required for this membership change.");
      return;
    }
    if (!invitationId || !invitation) return;

    setIsProcessing(true);
    try {
      // Force-refresh the ID token to ensure email_verified claim is current
      if (auth.currentUser) {
        await auth.currentUser.getIdToken(true);
      }
      await invitationService.acceptInvitation(invitationId);
      toast.success(`Joined group "${invitation.groupName}"!`);
      navigate(`/groups/${invitation.groupId}`);
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message || "Failed to accept invitation.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (isOffline) {
      toast.error("A connection is required for this membership change.");
      return;
    }
    if (!invitationId) return;

    setIsProcessing(true);
    try {
      await invitationService.declineInvitation(invitationId);
      toast.success("Invitation declined.");
      navigate("/groups");
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(e.message || "Failed to decline invitation.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <PageContainer title="Accept Invitation" description="Retrieving group invitation settings...">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </PageContainer>
    );
  }

  if (errorMsg || !invitation) {
    return (
      <PageContainer title="Invalid Invitation" description={errorMsg || "The invitation could not be resolved."}>
        <div className="max-w-md mx-auto text-center mt-12">
          <Button onClick={() => navigate("/groups")} variant="gradient" className="w-full">
            Return to Groups List
          </Button>
        </div>
      </PageContainer>
    );
  }

  // Verification checks
  const expiresAtTs = invitation.expiresAt as { toDate?: () => Date; seconds?: number } | null | undefined;
  const expiresDate = expiresAtTs?.toDate
    ? expiresAtTs.toDate()
    : expiresAtTs?.seconds
    ? new Date(expiresAtTs.seconds * 1000)
    : new Date();
  const isExpired = expiresDate.getTime() < now;

  if (!currentUser) {
    // Redirect to login page
    const loginRedirectUrl = `/auth/login?redirect=${encodeURIComponent(location.pathname)}`;
    return (
      <PageContainer title="Sign In Required" description="You must be logged in to accept group invitations.">
        <div className="max-w-md mx-auto text-left mt-8 glass-elevated border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            You received an invitation to join <span className="font-semibold text-text-primary">"{invitation.groupName}"</span>.
          </p>
          <Button onClick={() => navigate(loginRedirectUrl)} variant="gradient" className="w-full">
            Sign In to Accept
          </Button>
        </div>
      </PageContainer>
    );
  }

  const isMatchingEmail = invitation.invitedEmailLower && currentUser.email?.toLowerCase() === invitation.invitedEmailLower;
  const isMatchingUid = invitation.invitedUserId && currentUser.uid === invitation.invitedUserId;

  const isTargeted = invitation.invitedEmailLower || invitation.invitedUserId;
  const isOwnerMatching = isMatchingEmail || isMatchingUid;

  if (isTargeted && !isOwnerMatching) {
    return (
      <PageContainer title="Access Denied" description="This invitation was targeted to a different email address or user account.">
        <div className="max-w-md mx-auto text-left mt-8 glass-elevated border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex gap-2.5 items-start text-xs text-danger leading-relaxed bg-danger/5 p-3 rounded-xl border border-danger/25">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>
              You are signed in as <span className="font-semibold text-text-primary">{currentUser.email}</span>, but the invitation is registered to <span className="font-semibold text-text-primary">{invitation.invitedEmailLower || "a different user ID"}</span>.
            </span>
          </div>
          <Button onClick={() => navigate("/groups")} variant="ghost" className="w-full">
            Back to Groups
          </Button>
        </div>
      </PageContainer>
    );
  }

  if (invitation.invitedEmailLower && !currentUser.emailVerified) {
    return (
      <PageContainer title="Verify Email" description="You must verify your email address before accepting.">
        <div className="max-w-md mx-auto text-left mt-8 glass-elevated border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex gap-2.5 items-start text-xs text-warning leading-relaxed bg-warning/5 p-3 rounded-xl border border-warning/25">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>
              The invitation targeting your email requires account email verification to validate ownership.
            </span>
          </div>
          <Button onClick={() => navigate("/auth/verify-email")} variant="gradient" className="w-full">
            Verify Email Now
          </Button>
        </div>
      </PageContainer>
    );
  }

  if (invitation.status !== "pending") {
    return (
      <PageContainer title="Inactive Invitation" description={`This invitation is no longer active (status: ${invitation.status}).`}>
        <div className="max-w-md mx-auto text-center mt-12">
          <Button onClick={() => navigate("/groups")} variant="gradient" className="w-full">
            Back to Groups
          </Button>
        </div>
      </PageContainer>
    );
  }

  if (isExpired) {
    return (
      <PageContainer title="Expired Invitation" description="This invitation link has expired.">
        <div className="max-w-md mx-auto text-center mt-12">
          <Button onClick={() => navigate("/groups")} variant="gradient" className="w-full">
            Back to Groups
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Accept Invitation"
      description={`Join the shared split ledger group "${invitation.groupName}".`}
    >
      <div className="max-w-md mx-auto">
        <div className="glass-elevated border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col gap-6 text-left">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-bold text-text-primary">{invitation.groupName}</h3>
            <div className="flex items-center gap-1.5 text-xs text-text-muted mt-1">
              <UserCheck className="h-4 w-4 text-accent-cyan" />
              <span>Proposed role: <span className="capitalize font-semibold text-accent-cyan">{invitation.proposedRole}</span></span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-muted mt-1">
              <Calendar className="h-4 w-4 text-accent-indigo" />
              <span>Expires: {expiresDate.toLocaleDateString()}</span>
            </div>
          </div>

          <div className="flex gap-4 mt-2">
            <Button
              onClick={handleDecline}
              variant="ghost"
              className="flex-1 text-danger hover:bg-danger/5 border border-white/10"
              disabled={isProcessing}
            >
              Decline
            </Button>
            <Button
              onClick={handleAccept}
              variant="gradient"
              className="flex-1"
              isLoading={isProcessing}
            >
              Accept & Join
            </Button>
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default InvitationAcceptPage;
