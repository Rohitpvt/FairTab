import React, { useState } from "react";
import { authService } from "../../infrastructure/firebase/authService";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface GoogleSignInButtonProps {
  disabled?: boolean;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({ disabled = false }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await authService.signInWithGoogle();
      toast.success("Successfully logged in with Google!");
    } catch (error: unknown) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      toast.error(errorObj.message || "Google authentication failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const isBtnDisabled = disabled || isLoading;

  return (
    <button
      type="button"
      disabled={isBtnDisabled}
      onClick={handleGoogleSignIn}
      aria-label="Sign in with your Google Account"
      aria-busy={isLoading ? "true" : undefined}
      className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-white/10 glass-subtle hover:bg-surface-hover active:scale-98 transition-all duration-150 font-medium text-sm text-text-primary disabled:opacity-50 disabled:pointer-events-none cursor-pointer focus-visible:outline-2 focus-visible:outline-accent-cyan focus-visible:outline-offset-2"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-accent-cyan" aria-hidden="true" />
      ) : (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          width="24"
          height="24"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <g transform="matrix(1, 0, 0, 1, 0, 0)">
            <path
              d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.58h3.3c1.93,-1.78 3.04,-4.4 3.04,-7.47c0,-0.68 -0.06,-1.34 -0.17,-1.91Z"
              fill="#4285f4"
            />
            <path
              d="M12,20.6c2.43,0 4.47,-0.81 5.96,-2.2l-3.3,-2.58c-0.91,0.61 -2.08,0.98 -3.34,0.98c-2.34,0 -4.32,-1.58 -5.03,-3.7H2.86v2.66c1.49,2.97 4.56,5.02 8.14,5.02Z"
              fill="#34a853"
            />
            <path
              d="M6.97,13.1c-0.18,-0.54 -0.28,-1.11 -0.28,-1.7c0,-0.59 0.1,-1.16 0.28,-1.7V7.04H2.86C2.26,8.23 1.92,9.58 1.92,11c0,1.42 0.34,2.77 0.94,3.96l4.11,-2.86Z"
              fill="#fbbc05"
            />
            <path
              d="M12,5.2c1.32,0 2.51,0.45 3.44,1.35l2.58,-2.58C16.46,2.5 14.43,1.4 12,1.4C8.42,1.4 5.35,3.45 3.86,6.42l4.11,2.86c0.71,-2.12 2.69,-3.7 5.03,-3.7Z"
              fill="#ea4335"
            />
          </g>
        </svg>
      )}
      <span>Sign in with Google</span>
    </button>
  );
};

export default GoogleSignInButton;
