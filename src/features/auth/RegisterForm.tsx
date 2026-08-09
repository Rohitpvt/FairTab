import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { authService } from "../../infrastructure/firebase/authService";
import { useAuth } from "./AuthProvider";
import { Button } from "../../components/ui/Button";
import { GoogleSignInButton } from "./GoogleSignInButton";
import { toast } from "sonner";

import { registerSchema } from "./registerSchema";
import type { RegisterFormData } from "./registerSchema";

export const RegisterForm: React.FC = () => {
  const navigate = useNavigate();
  const { setTrustedDevicePreference, bootstrapProfile } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      displayName: "",
      email: "",
      password: "",
      confirmPassword: "",
      rememberDevice: false
    }
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(false);
    setIsLoading(true);
    setSubmitError(null);
    try {
      // Configure trusted-device status before registration
      await setTrustedDevicePreference(data.rememberDevice);

      // 1. Create the Auth credentials
      const credential = await authService.registerEmail(data.email, data.password);

      // 2. Create profile document idempotently
      await bootstrapProfile(credential.user, data.displayName);

      // 3. Send verification email
      await authService.sendVerificationEmail(credential.user);

      toast.success("Successfully registered! A verification email has been sent.");
      
      // 4. Redirect to verification screen
      navigate("/auth/verify-email");
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      const msg = errorObj.message || "Registration failed.";
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const firstErrorKey = (Object.keys(errors) as (keyof RegisterFormData)[])[0];
  const validationError = firstErrorKey ? (errors[firstErrorKey]?.message || "Validation error") : null;
  const liveError = validationError || submitError;

  return (
    <div className="flex flex-col gap-5">
      {/* ARIA Live region for error announcements */}
      <div aria-live="assertive" className="sr-only" role="alert">
        {liveError || ""}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 text-left">
        {/* Full Name / Display Name */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reg-name" className="text-xs font-semibold text-text-secondary">
            Display Name *
          </label>
          <input
            id="reg-name"
            type="text"
            placeholder="Jane Doe"
            className={`px-3.5 py-2.5 bg-surface-primary border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-cyan ${
              errors.displayName ? "border-danger" : "border-white/10"
            }`}
            aria-invalid={errors.displayName ? "true" : "false"}
            aria-describedby={errors.displayName ? "reg-name-error" : undefined}
            {...register("displayName")}
          />
          {errors.displayName && (
            <span id="reg-name-error" className="text-xs text-danger font-medium mt-0.5">
              {errors.displayName.message}
            </span>
          )}
        </div>

        {/* Email Address */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reg-email" className="text-xs font-semibold text-text-secondary">
            Email Address *
          </label>
          <input
            id="reg-email"
            type="email"
            placeholder="name@example.com"
            className={`px-3.5 py-2.5 bg-surface-primary border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-cyan ${
              errors.email ? "border-danger" : "border-white/10"
            }`}
            aria-invalid={errors.email ? "true" : "false"}
            aria-describedby={errors.email ? "reg-email-error" : undefined}
            {...register("email")}
          />
          {errors.email && (
            <span id="reg-email-error" className="text-xs text-danger font-medium mt-0.5">
              {errors.email.message}
            </span>
          )}
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reg-password" className="text-xs font-semibold text-text-secondary">
            Password *
          </label>
          <div className="relative">
            <input
              id="reg-password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              className={`w-full px-3.5 py-2.5 bg-surface-primary border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-cyan pr-10 ${
                errors.password ? "border-danger" : "border-white/10"
              }`}
              aria-invalid={errors.password ? "true" : "false"}
              aria-describedby={errors.password ? "reg-password-error" : undefined}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5 cursor-pointer"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <span id="reg-password-error" className="text-xs text-danger font-medium mt-0.5">
              {errors.password.message}
            </span>
          )}
        </div>

        {/* Confirm Password */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reg-confirm-password" className="text-xs font-semibold text-text-secondary">
            Confirm Password *
          </label>
          <div className="relative">
            <input
              id="reg-confirm-password"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="••••••••"
              className={`w-full px-3.5 py-2.5 bg-surface-primary border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-cyan pr-10 ${
                errors.confirmPassword ? "border-danger" : "border-white/10"
              }`}
              aria-invalid={errors.confirmPassword ? "true" : "false"}
              aria-describedby={errors.confirmPassword ? "reg-confirm-password-error" : undefined}
              {...register("confirmPassword")}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5 cursor-pointer"
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <span id="reg-confirm-password-error" className="text-xs text-danger font-medium mt-0.5">
              {errors.confirmPassword.message}
            </span>
          )}
        </div>

        {/* Remember Device Choice */}
        <div className="flex items-start gap-2.5 py-1">
          <input
            id="reg-remember-device"
            type="checkbox"
            className="w-4 h-4 bg-surface-primary border border-white/10 rounded focus:ring-accent-cyan accent-accent-cyan mt-0.5 cursor-pointer"
            {...register("rememberDevice")}
          />
          <div className="flex flex-col text-xs leading-normal">
            <label htmlFor="reg-remember-device" className="font-semibold text-text-secondary cursor-pointer">
              Remember FairTab data on this device?
            </label>
            <p className="text-text-muted mt-0.5">
              Enable this only on a private or trusted device. Cached account data may remain available after the browser closes.
            </p>
          </div>
        </div>

        {/* Submit Action */}
        <Button
          type="submit"
          variant="gradient"
          className="w-full mt-2"
          isLoading={isLoading}
          loadingText="Creating account..."
        >
          Create Account
        </Button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3 my-1">
        <div className="flex-1 h-px bg-white/5" />
        <span className="text-xxs text-text-muted uppercase tracking-wider font-semibold">Or continue with</span>
        <div className="flex-1 h-px bg-white/5" />
      </div>

      {/* Google Provider Button */}
      <GoogleSignInButton disabled={isLoading} />

      {/* Bottom redirection Link */}
      <div className="text-center text-xs text-text-muted mt-2">
        Already have an account?{" "}
        <Link to="/auth/login" className="text-accent-cyan hover:underline font-semibold">
          Sign in
        </Link>
      </div>
    </div>
  );
};

export default RegisterForm;
