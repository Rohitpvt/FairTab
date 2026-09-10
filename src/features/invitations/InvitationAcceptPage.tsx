/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { UserCheck, AlertTriangle, ShieldCheck, RefreshCw, AlertCircle } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { PageContainer } from "../../components/layout/PageContainer";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import { auth, db } from "../../infrastructure/firebase/firebase";
import { useAuth } from "../auth/AuthProvider";
import { fairtabApi } from "../../infrastructure/api/fairtabApi";
import { toast } from "sonner";
import { AuthLayout } from "../auth/AuthLayout";

// SHA-256 helper for client-side direct token lookup fallback
async function sha256Hex(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

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

  const { user: currentUser, authState } = useAuth();
  const isOffline = !navigator.onLine;

  const [isResolving, setIsResolving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(() => actualToken ? null : "No invitation token provided.");
  const [resolveAttempt, setResolveAttempt] = useState(0);

  const retryResolve = useCallback(() => {
    setResolveAttempt((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!actualToken || !currentUser) {
      return;
    }

    // Wait until Firebase auth initialization finishes before resolving
    if (authState === "initializing") {
      return;
    }

    let isMounted = true;
    const resolveToken = async () => {
      setIsResolving(true);
      setErrorMsg(null);

      // Attempt 1: Direct Firestore query for global links (instant & ultra-reliable)
      try {
        const hashedToken = await sha256Hex(actualToken);
        const globalLinkRef = doc(db, "globalInviteLinks", hashedToken);
        const globalLinkSnap = await getDoc(globalLinkRef);

        if (globalLinkSnap.exists()) {
          const linkData = globalLinkSnap.data();
          if (linkData.status !== "active") {
            if (isMounted) {
              setErrorMsg("This invite link has been revoked or is no longer active.");
              setIsResolving(false);
            }
            return;
          }
          if (linkData.expiresAt && Date.now() > (linkData.expiresAt.toDate ? linkData.expiresAt.toDate().getTime() : new Date(linkData.expiresAt).getTime())) {
            if (isMounted) {
              setErrorMsg("This invite link has expired.");
              setIsResolving(false);
            }
            return;
          }

          if (isMounted) {
            setResolvedDetails({
              type: "global",
              groupName: linkData.groupName || "FairTab Group",
              proposedRole: linkData.proposedRole || "member",
            });
            setIsResolving(false);
          }
          return;
        }
      } catch (firestoreErr: any) {
        console.warn("Direct Firestore token resolution fallback note:", firestoreErr);
      }

      // Attempt 2: Call fairtabApi backend endpoint (for email invites and server validation)
      try {
        if (auth.currentUser) {
          await auth.currentUser.getIdToken();
        }
        const res: any = await fairtabApi.invitations.resolveInviteToken({ token: actualToken });
        if (isMounted && res && res.groupName) {
          setResolvedDetails(res);
          setIsResolving(false);
          return;
        }
      } catch (apiErr: any) {
        console.warn("Backend resolveToken returned error:", apiErr);
      }

      // If both fail:
      if (isMounted) {
        setErrorMsg("Unable to load invitation details. Please check your connection or verify that the link is valid.");
        setIsResolving(false);
      }
    };

    resolveToken();

    return () => {
      isMounted = false;
    };
  }, [actualToken, currentUser, authState, resolveAttempt]);

  const isResolvingState = isResolving || (!!currentUser && (authState === "initializing" || authState === "authenticated-profile-loading"));
  const isLoading = isResolvingState && !errorMsg && !resolvedDetails;

  const handleAcceptEmailInvite = async () => {
    if (isOffline) {
      toast.error("Internet connection required.");
      return;
    }
    if (!actualToken) return;

    setIsProcessing(true);
    try {
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
      if (auth.currentUser) {
        await auth.currentUser.getIdToken();
      }
      await fairtabApi.invitations.requestJoinGlobal({ token: actualToken });
      toast.success("Join request submitted successfully!");
      navigate("/groups");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit join request.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!currentUser && authState !== "initializing") {
    // Store token in sessionStorage for redirection bridge
    if (actualToken) {
      sessionStorage.setItem("fairtab:pending-invite-token", actualToken);
      sessionStorage.setItem("fairtab:pending-invite-type", isGlobalJoin ? "global" : "email");
    }

    const loginRedirectUrl = `/auth/login?redirect=${encodeURIComponent(location.pathname)}`;
    return (
      <AuthLayout title="Sign In Required" subtitle="Join shared ledger groups on FairTab">
        <div className="flex flex-col gap-4 text-left">
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
      </AuthLayout>
    );
  }

  if (isLoading) {
    return (
      <AuthLayout title="Resolving Invitation" subtitle="Fetching secure invitation details...">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </AuthLayout>
    );
  }

  if (errorMsg || !resolvedDetails) {
    return (
      <PageContainer title="Invitation Unavailable" description={errorMsg || "The invitation could not be resolved."}>
        <div className="max-w-md mx-auto text-center mt-8 glass-elevated border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col gap-5">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center text-danger">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="flex flex-col gap-1.5">
            <h4 className="text-base font-bold text-text-primary">Unable to Resolve Link</h4>
            <p className="text-xs text-text-secondary leading-relaxed">
              {errorMsg || "The invitation link is either invalid, expired, or the server could not be reached."}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <Button onClick={retryResolve} variant="secondary" className="flex-1 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4" />
              <span>Retry Link</span>
            </Button>
            <Button onClick={() => navigate("/groups")} variant="gradient" className="flex-1">
              Return to Groups
            </Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  // If email invite, check verified email
  if (resolvedDetails.type === "email") {
    if (!currentUser?.emailVerified) {
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
