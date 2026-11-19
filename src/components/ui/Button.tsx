import React from "react";
import { CoolLoader } from "../feedback/CoolLoader";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "gradient";
  size?: "sm" | "md" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = "",
      isLoading = false,
      loadingText,
      variant = "primary",
      size = "md",
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "relative inline-flex items-center justify-center font-medium transition-all duration-150 ease-out focus-visible:outline-2 focus-visible:outline-accent-gold focus-visible:outline-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100";

    const variantStyles = {
      primary: "bg-accent-gold text-bg-base hover:bg-accent-gold-hover font-semibold border border-accent-gold/40 shadow-sm",
      secondary: "glass-subtle text-text-primary hover:bg-surface-hover hover:border-border-color border border-border-color/80 shadow-sm",
      danger: "bg-danger text-white hover:bg-opacity-90 border border-transparent shadow-sm",
      ghost: "text-text-secondary hover:bg-surface-hover hover:text-text-primary border border-transparent",
      gradient:
        "bg-accent-gold text-bg-base hover:bg-accent-gold-hover font-semibold border border-accent-gold/40 shadow-sm",
    };

    const sizeStyles = {
      sm: "px-3 py-1.5 text-xs rounded-xl min-h-[36px]",
      md: "px-4 py-2 text-sm rounded-xl min-h-[42px] sm:min-h-[44px]",
      lg: "px-5 py-2.5 text-base rounded-2xl min-h-[48px]",
      icon: "p-2 rounded-full min-w-[44px] min-h-[44px] justify-center items-center",
    };

    const isBtnDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        disabled={isBtnDisabled}
        aria-busy={isLoading ? "true" : undefined}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        <span className={`inline-flex items-center justify-center gap-2 ${isLoading ? "opacity-0" : "opacity-100"}`}>
          {children}
        </span>

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-current">
            <CoolLoader size="xs" />
            {loadingText && <span className="text-xs font-semibold">{loadingText}</span>}
          </div>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
