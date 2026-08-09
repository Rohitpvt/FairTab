import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { authService } from "../../infrastructure/firebase/authService";
import { auth } from "../../infrastructure/firebase/firebase";
import { Button } from "../../components/ui/Button";
import { AuthLayout } from "./AuthLayout";
import { Mail, RefreshCw, LogOut, WifiOff } from "lucide-react";
import { toast } from "sonner";

export const VerifyEmailPage: React.FC = () => {
  const { user, refreshProfile, signOut } = useAuth();
  const [isResending, setIsResending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string | null>(null);

  // Monitor network status
  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (isOffline) {
      toast.error("Device is offline. Cannot request verification email.");
      return;
    }
    if (!user) return;
    setIsResending(true);
    setLiveAnnouncement("Requesting a new verification email link...");
    try {
      await authService.sendVerificationEmail(user);
      setCooldown(60); // 60 seconds cooldown
      setLiveAnnouncement("Verification link dispatched. Cooldown timer activated.");
      toast.success("Verification email sent successfully!");
    } catch (error: unknown) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      toast.error(errorObj.message || "Failed to resend email.");
    } finally {
      setIsResending(false);
    }
  };

  const handleRefresh = async () => {
    if (isOffline) {
      toast.error("Device is offline. Cannot check remote status.");
      return;
    }
    setIsRefreshing(true);
    setLiveAnnouncement("Refreshing account verification credentials...");
    try {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        await auth.currentUser.getIdToken(true);
        await refreshProfile();
        
        const isVerified = auth.currentUser.emailVerified;
        if (isVerified) {
          toast.success("Email verified successfully!");
          setLiveAnnouncement("Account verification confirmed. Redirecting to setup.");
        } else {
          toast.info("Email is not verified yet. Please check your inbox and click the link.");
          setLiveAnnouncement("Email remains unverified.");
        }
      }
    } catch (error: unknown) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      toast.error(errorObj.message || "Failed to refresh status.");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <AuthLayout
      title="Verify Your Email"
      subtitle={`We sent a verification link to ${user?.email || "your address"}.`}
    >
      <div className="flex flex-col gap-6 text-center">
        {/* ARIA live region */}
        <div aria-live="polite" className="sr-only" role="status">
          {liveAnnouncement}
        </div>

        {/* Offline Warning Banner */}
        {isOffline && (
          <div className="flex items-center gap-2 px-3 py-2 bg-danger/10 border border-danger/20 rounded-lg text-danger text-xs text-left">
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>You are currently offline. Status checks are disabled.</span>
          </div>
        )}

        {/* Icon Header */}
        <div className="flex justify-center">
          <div className="p-4 bg-accent-cyan/10 border border-accent-cyan/20 rounded-full text-accent-cyan animate-pulse">
            <Mail className="h-10 w-10" />
          </div>
        </div>

        <p className="text-xs text-text-secondary leading-relaxed">
          Please check your email client (including spam folder) and click the activation link to complete security registration.
        </p>

        {/* Action Controls */}
        <div className="flex flex-col gap-3">
          <Button
            onClick={handleRefresh}
            variant="gradient"
            className="w-full flex items-center justify-center gap-2"
            isLoading={isRefreshing}
            disabled={isOffline}
            loadingText="Verifying..."
          >
            {!isRefreshing && <RefreshCw className="h-4 w-4" />}
            Refresh Verification Status
          </Button>

          <Button
            onClick={handleResend}
            variant="secondary"
            className="w-full"
            disabled={cooldown > 0 || isResending || isOffline}
            isLoading={isResending}
            loadingText="Resending..."
          >
            {cooldown > 0 ? `Resend Email (${cooldown}s)` : "Resend Verification Email"}
          </Button>
        </div>

        {/* Sign out link */}
        <button
          type="button"
          onClick={() => signOut(true)}
          className="flex items-center justify-center gap-2 text-xs text-text-muted hover:text-danger hover:underline transition-colors py-2 cursor-pointer w-fit mx-auto"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out / Change Account</span>
        </button>
      </div>
    </AuthLayout>
  );
};

export default VerifyEmailPage;
