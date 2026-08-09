import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { authService } from "../../infrastructure/firebase/authService";
import { Button } from "../../components/ui/Button";
import { toast } from "sonner";

import { forgotPasswordSchema } from "./forgotPasswordSchema";
import type { ForgotPasswordFormData } from "./forgotPasswordSchema";

export const ForgotPasswordForm: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: ""
    }
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(false);
    setIsLoading(true);
    setSubmitError(null);
    setIsSent(false);
    try {
      await authService.sendPasswordReset(data.email);
      setIsSent(true);
      toast.success("Password reset link sent! Check your inbox.");
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      const msg = errorObj.message || "Failed to send reset link.";
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const validationError = errors.email?.message || null;
  const liveError = validationError || submitError;

  return (
    <div className="flex flex-col gap-4">
      {/* Live region for accessibility */}
      <div aria-live="assertive" className="sr-only" role="alert">
        {liveError || ""}
      </div>

      {isSent ? (
        <div className="text-center py-4 flex flex-col gap-4">
          <p className="text-sm text-text-secondary leading-relaxed">
            We have sent a password reset link to your email address. Please click the link to configure a new password.
          </p>
          <Link to="/auth/login" className="w-full">
            <Button variant="secondary" className="w-full">
              Back to Sign In
            </Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 text-left">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reset-email" className="text-xs font-semibold text-text-secondary">
              Email Address *
            </label>
            <input
              id="reset-email"
              type="email"
              placeholder="name@example.com"
              className={`px-3.5 py-2.5 bg-surface-primary border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-cyan ${
                errors.email ? "border-danger" : "border-white/10"
              }`}
              aria-invalid={errors.email ? "true" : "false"}
              aria-describedby={errors.email ? "reset-email-error" : undefined}
              {...register("email")}
            />
            {errors.email && (
              <span id="reset-email-error" className="text-xs text-danger font-medium mt-0.5">
                {errors.email.message}
              </span>
            )}
          </div>

          <Button
            type="submit"
            variant="gradient"
            className="w-full mt-2"
            isLoading={isLoading}
            loadingText="Sending link..."
          >
            Send Reset Link
          </Button>

          <div className="text-center text-xs text-text-muted mt-2">
            Remember your password?{" "}
            <Link to="/auth/login" className="text-accent-cyan hover:underline font-semibold">
              Sign in
            </Link>
          </div>
        </form>
      )}
    </div>
  );
};

export default ForgotPasswordForm;
