import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "../../components/ui/Button";

/**
 * Clean, glassmorphic loading skeleton screen for authentication resolution.
 */
export const AuthLoadingSkeleton: React.FC = () => {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#060810] text-text-primary z-50">
      <div className="relative flex flex-col items-center p-8 max-w-sm w-full mx-4 rounded-2xl glass-elevated border border-white/10 shadow-2xl text-center">
        {/* Animated outer ring */}
        <div className="relative flex items-center justify-center w-16 h-16 mb-4">
          <Loader2 className="w-10 h-10 text-accent-cyan animate-spin" />
        </div>
        <h2 className="text-lg font-bold bg-gradient-to-r from-accent-indigo via-accent-violet to-accent-cyan bg-clip-text text-transparent mb-1">
          FairTab
        </h2>
        <p className="text-xs text-text-muted">Resolving secure environment...</p>
      </div>
    </div>
  );
};

/**
 * Screen to show authentication block errors.
 */
export const AuthErrorState: React.FC<{ message: string | null }> = ({ message }) => {
  const { signOut } = useAuth();
  
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#060810] text-text-primary z-50">
      <div className="flex flex-col items-center p-8 max-w-md w-full mx-4 rounded-2xl glass-elevated border border-danger/20 shadow-2xl text-center">
        <div className="p-3 bg-danger/10 border border-danger/20 rounded-full text-danger mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-text-primary mb-2">
          Security Resolve Failure
        </h2>
        <p className="text-sm text-text-secondary mb-6 leading-relaxed">
          {message || "An unexpected error occurred while loading your profile."}
        </p>
        <Button variant="ghost" className="w-full" onClick={() => signOut(true)}>
          Reset Session & Return
        </Button>
      </div>
    </div>
  );
};

/**
 * Restricts access to authenticated, email-verified, and onboarded users.
 */
export const ProtectedRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { authState, error } = useAuth();

  if (authState === "initializing" || authState === "authenticated-profile-loading") {
    return <AuthLoadingSkeleton />;
  }

  if (authState === "error") {
    return <AuthErrorState message={error} />;
  }

  if (authState === "unauthenticated") {
    return <Navigate to="/auth/login" replace />;
  }

  if (authState === "email-verification-required") {
    return <Navigate to="/auth/verify-email" replace />;
  }

  if (authState === "onboarding-required") {
    return <Navigate to="/onboarding" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

/**
 * Restricts access to unauthenticated users only (e.g. login/register pages).
 * Automatically redirects authenticated/verified/onboarded users to their valid landing pages.
 */
export const PublicOnlyRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { authState } = useAuth();

  if (authState === "initializing" || authState === "authenticated-profile-loading") {
    return <AuthLoadingSkeleton />;
  }

  if (authState === "email-verification-required") {
    return <Navigate to="/auth/verify-email" replace />;
  }

  if (authState === "onboarding-required") {
    return <Navigate to="/onboarding" replace />;
  }

  if (authState === "ready") {
    const pendingToken = sessionStorage.getItem("fairtab:pending-invite-token");
    const pendingType = sessionStorage.getItem("fairtab:pending-invite-type") || "email";
    if (pendingToken) {
      sessionStorage.removeItem("fairtab:pending-invite-token");
      sessionStorage.removeItem("fairtab:pending-invite-type");
      const path = pendingType === "global" ? `/join/${pendingToken}` : `/invite/${pendingToken}`;
      return <Navigate to={path} replace />;
    }
    return <Navigate to="/overview" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

/**
 * Guard specifically for unverified users undergoing email validation.
 */
export const VerifyEmailRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { authState, error } = useAuth();

  if (authState === "initializing" || authState === "authenticated-profile-loading") {
    return <AuthLoadingSkeleton />;
  }

  if (authState === "error") {
    return <AuthErrorState message={error} />;
  }

  if (authState === "unauthenticated") {
    return <Navigate to="/auth/login" replace />;
  }

  if (authState === "onboarding-required") {
    return <Navigate to="/onboarding" replace />;
  }

  if (authState === "ready") {
    const pendingToken = sessionStorage.getItem("fairtab:pending-invite-token");
    const pendingType = sessionStorage.getItem("fairtab:pending-invite-type") || "email";
    if (pendingToken) {
      sessionStorage.removeItem("fairtab:pending-invite-token");
      sessionStorage.removeItem("fairtab:pending-invite-type");
      const path = pendingType === "global" ? `/join/${pendingToken}` : `/invite/${pendingToken}`;
      return <Navigate to={path} replace />;
    }
    return <Navigate to="/overview" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

/**
 * Guard specifically for onboarders.
 */
export const OnboardingRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { authState, error } = useAuth();

  if (authState === "initializing" || authState === "authenticated-profile-loading") {
    return <AuthLoadingSkeleton />;
  }

  if (authState === "error") {
    return <AuthErrorState message={error} />;
  }

  if (authState === "unauthenticated") {
    return <Navigate to="/auth/login" replace />;
  }

  if (authState === "email-verification-required") {
    return <Navigate to="/auth/verify-email" replace />;
  }

  if (authState === "ready") {
    return <Navigate to="/overview" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
