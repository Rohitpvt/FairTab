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

import { loginSchema } from "./loginSchema";
import type { LoginFormData } from "./loginSchema";

export const LoginForm: React.FC = () => {
  const navigate = useNavigate();
  const { setTrustedDevicePreference } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberDevice: false
    }
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const rememberDevice = watch("rememberDevice");

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(false);
    setIsLoading(true);
    setSubmitError(null);
    try {
      // Ensure persistence is set BEFORE the sign-in operation
      await setTrustedDevicePreference(data.rememberDevice);

      await authService.loginEmail(data.email, data.password, data.rememberDevice);
      toast.success("Successfully logged in!");
      navigate("/overview");
    } catch (err: unknown) {
      try {
        sessionStorage.removeItem("fairtab:pending-remember");
      } catch (e) {
        console.warn("sessionStorage cleanup error:", e);
      }
      const errorObj = err instanceof Error ? err : new Error(String(err));
      const msg = errorObj.message || "Login failed.";
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const firstErrorKey = (Object.keys(errors) as (keyof LoginFormData)[])[0];
  const validationError = firstErrorKey ? (errors[firstErrorKey]?.message || "Validation error") : null;
  const liveError = validationError || submitError;

  return (
    <div className="flex flex-col gap-5">
      {/* Accessibility ARIA Live Region for screen readers to announce errors */}
      <div aria-live="assertive" className="sr-only" role="alert">
        {liveError || ""}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 text-left">
        {/* Email Field */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="login-email" className="text-xs font-semibold text-text-secondary">
            Email Address *
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            className={`px-3.5 py-2.5 bg-surface-primary border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-cyan ${
              errors.email ? "border-danger" : "border-white/10"
            }`}
            aria-invalid={errors.email ? "true" : "false"}
            aria-describedby={errors.email ? "login-email-error" : undefined}
            {...register("email")}
          />
          {errors.email && (
            <span id="login-email-error" className="text-xs text-danger font-medium mt-0.5">
              {errors.email.message}
            </span>
          )}
        </div>

        {/* Password Field */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <label htmlFor="login-password" className="text-xs font-semibold text-text-secondary">
              Password *
            </label>
            <Link
              to="/auth/forgot-password"
              className="text-xs text-accent-cyan hover:underline font-medium"
            >
              Forgot Password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              className={`w-full px-3.5 py-2.5 bg-surface-primary border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-cyan pr-10 ${
                errors.password ? "border-danger" : "border-white/10"
              }`}
              aria-invalid={errors.password ? "true" : "false"}
              aria-describedby={errors.password ? "login-password-error" : undefined}
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
            <span id="login-password-error" className="text-xs text-danger font-medium mt-0.5">
              {errors.password.message}
            </span>
          )}
        </div>

        {/* Remember Device Choice */}
        <div className="flex items-start gap-2.5 py-1">
          <input
            id="remember-device"
            type="checkbox"
            className="w-4 h-4 bg-surface-primary border border-white/10 rounded focus:ring-accent-cyan accent-accent-cyan mt-0.5 cursor-pointer"
            {...register("rememberDevice")}
          />
          <div className="flex flex-col text-xs leading-normal">
            <label htmlFor="remember-device" className="font-semibold text-text-secondary cursor-pointer">
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
          loadingText="Signing in..."
        >
          Sign In
        </Button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3 my-1">
        <div className="flex-1 h-px bg-white/5" />
        <span className="text-xxs text-text-muted uppercase tracking-wider font-semibold">Or continue with</span>
        <div className="flex-1 h-px bg-white/5" />
      </div>

      {/* Google Provider Button */}
      <GoogleSignInButton disabled={isLoading} rememberDevice={rememberDevice} />

      {/* Bottom redirection Link */}
      <div className="text-center text-xs text-text-muted mt-2">
        Don't have an account?{" "}
        <Link to="/auth/register" className="text-accent-cyan hover:underline font-semibold">
          Create account
        </Link>
      </div>
    </div>
  );
};

export default LoginForm;
