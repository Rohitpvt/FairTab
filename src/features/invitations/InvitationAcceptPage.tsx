/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { UserCheck, AlertTriangle, ShieldCheck } from "lucide-react";
import { PageContainer } from "../../components/layout/PageContainer";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import { auth } from "../../infrastructure/firebase/firebase";
import { fairtabApi } from "../../infrastructure/api/fairtabApi";
import { toast } from "sonner";

export const InvitationAcceptPage: React.FC = () => {
  const { invitationId, token } = useParams<{ invitationId?: string; token?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [resolvedDetails, setResolvedDetails] = useState<{
    type: "email" | "global";
    groupName: string;
    inviterName?: string;
    proposedRole: string;
  } | null>(null);

  const actualToken = token || invitationId;
  const isGlobalJoin = location.pathname.includes("/join/");

  const [isLoading, setIsLoading] = useState(() => !!actualToken);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(() => actualToken ? null : "No invitation token provided.");

  const currentUser = auth.currentUser;
  const isOffline = !navigator.onLine;

  useEffect(() => {
    if (!actualToken) {
      return;
    }

    const resolveToken = async () => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        // We call resolveInviteToken backend helper to get the details secure server-side
        const res: any = await fairtabApi.invitations.resolveInviteToken({ token: actualToken });
        setResolvedDetails(res);
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to resolve invitation token.");
      } finally {
        setIsLoading(false);
      }
    };

    if (currentUser) {
      resolveToken();
    }
  }, [actualToken, currentUser]);

  const handleAcceptEmailInvite = async () => {
    if (isOffline) {
      toast.error("Internet connection required.");
      return;
    }
    if (!actualToken) return;

    setIsProcessing(true);
    try {
      // Force refresh auth token for email_verified claim update
      if (auth.currentUser) {
        await auth.currentUser.getIdToken(true);
      }
      const res: any = await fairtabApi.invitations.acceptEmail({ token: actualToken });
      toast.success("Joined group successfully!");
      navigate(`/groups/${res.groupId}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to accept invitation.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRequestJoin = async () => {
    if (isOffline) {
      toast.error("Internet connection required.");
      return;
    }
    if (!actualToken) return;

    setIsProcessing(true);
    try {
      await fairtabApi.invitations.requestJoinGlobal({ token: actualToken });
      toast.success("Join request submitted successfully!");
      navigate("/groups");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit join request.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!currentUser) {
    // Store token in sessionStorage for redirection bridge
    if (actualToken) {
      sessionStorage.setItem("fairtab:pending-invite-token", actualToken);
      sessionStorage.setItem("fairtab:pending-invite-type", isGlobalJoin ? "global" : "email");
    }

    const loginRedirectUrl = `/auth/login?redirect=${encodeURIComponent(location.pathname)}`;
    return (
      <PageContainer title="Sign In Required" description="Join shared ledger groups on FairTab.">
        <div className="max-w-md mx-auto text-left mt-8 glass-elevated border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
          <p className="text-sm text-text-secondary leading-relaxed">
            You opened an invitation link. Please sign in or register to join the group or submit a join request.
          </p>
          <div className="flex gap-3">
            <Button onClick={() => navigate(`/auth/register?redirect=${encodeURIComponent(location.pathname)}`)} variant="secondary" className="flex-1">
              Register
            </Button>
            <Button onClick={() => navigate(loginRedirectUrl)} variant="gradient" className="flex-1">
              Sign In
            </Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (isLoading) {
    return (
      <PageContainer title="Resolving Invitation" description="Fetching secure invitation details...">
        <div className="max-w-md mx-auto flex flex-col gap-4 mt-8">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </PageContainer>
    );
  }

  if (errorMsg || !resolvedDetails) {
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

  // If email invite, check verified email
  if (resolvedDetails.type === "email") {
    if (!currentUser.emailVerified) {
      return (
        <PageContainer title="Verify Email" description="Account verification required.">
          <div className="max-w-md mx-auto text-left mt-8 glass-elevated border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
            <div className="flex gap-2.5 items-start text-xs text-warning leading-relaxed bg-warning/5 p-3 rounded-xl border border-warning/25">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>
                To accept this email-targeted invitation, please verify your email address to validate ownership.
              </span>
            </div>
            <Button onClick={() => navigate("/auth/verify-email")} variant="gradient" className="w-full">
              Verify Email Now
            </Button>
          </div>
        </PageContainer>
      );
    }
  }

  return (
    <PageContainer
      title={resolvedDetails.type === "email" ? "Accept Invitation" : "Join Group"}
      description={resolvedDetails.type === "email" ? "You've been invited to join a split ledger group." : "Request to join a shared split ledger group."}
    >
      <div className="max-w-md mx-auto mt-6">
        <div className="glass-elevated border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col gap-6 text-left">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-accent-cyan px-2 py-1 bg-accent-cyan/10 rounded-full">
              {resolvedDetails.type === "email" ? "Targeted Invite" : "Global Link"}
            </span>
            <h3 className="text-xl font-extrabold text-text-primary mt-3">{resolvedDetails.groupName}</h3>
            {resolvedDetails.inviterName && (
              <p className="text-xs text-text-secondary mt-1">
                Invited by: <span className="font-semibold text-text-primary">{resolvedDetails.inviterName}</span>
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3.5 border-y border-white/5 py-4">
            <div className="flex items-center gap-2.5 text-sm text-text-secondary">
              <UserCheck className="h-4 w-4 text-accent-cyan shrink-0" />
              <span>Proposed role: <span className="capitalize font-semibold text-text-primary">{resolvedDetails.proposedRole}</span></span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-text-secondary">
              <ShieldCheck className="h-4 w-4 text-accent-indigo shrink-0" />
              <span>
                {resolvedDetails.type === "email"
                  ? "Direct Join (No approval required)"
                  : "Approval Required (Group Admin will review)"}
              </span>
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={() => navigate("/groups")}
              variant="ghost"
              className="flex-1 border border-white/10"
              disabled={isProcessing}
            >
              Cancel
            </Button>
            {resolvedDetails.type === "email" ? (
              <Button
                onClick={handleAcceptEmailInvite}
                variant="gradient"
                className="flex-1"
                isLoading={isProcessing}
              >
                Accept & Join
              </Button>
            ) : (
              <Button
                onClick={handleRequestJoin}
                variant="gradient"
                className="flex-1"
                isLoading={isProcessing}
              >
                Request to Join
              </Button>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default InvitationAcceptPage;
