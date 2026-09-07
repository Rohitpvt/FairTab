import React, { useId } from "react";

export interface CoolLoaderProps {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  label?: string;
}

export const CoolLoader: React.FC<CoolLoaderProps> = ({
  size = "md",
  className = "",
  label,
}) => {
  const rawId = useId();
  const gradientId = "cool-grad-" + rawId.replace(/[^a-zA-Z0-9_-]/g, "");

  const sizeClass = {
    xs: "pl-xs",
    sm: "pl-sm",
    md: "pl-md",
    lg: "pl-lg",
  }[size];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label || "Loading..."}
      className={`inline-flex flex-col items-center justify-center ${className}`}
    >
      <svg
        className={`pl ${sizeClass}`}
        viewBox="0 0 128 128"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--accent-cyan))" />
            <stop offset="50%" stopColor="hsl(var(--accent-violet))" />
            <stop offset="100%" stopColor="hsl(var(--accent-indigo))" />
          </linearGradient>
        </defs>
        <circle
          className="pl__ring"
          r="56"
          cx="64"
          cy="64"
          fill="none"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <path
          className="pl__worm"
          d="M92,15.492S78.194,4.967,66.743,16.887c-17.231,17.938-28.26,96.974-28.26,96.974L119.85,59.892l-99-31.588,57.528,89.832L97.8,19.349,13.636,88.51l89.012,16.015S81.908,38.332,66.1,22.337C50.114,6.156,36,15.492,36,15.492a56,56,0,1,0,56,0Z"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="16"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label && (
        <span className="mt-3 text-xs font-semibold tracking-wide text-text-muted uppercase">
          {label}
        </span>
      )}
    </div>
  );
};

export default CoolLoader;
