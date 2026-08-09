import React from "react";

export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "subtle" | "standard" | "elevated";
  hoverable?: boolean;
}

export const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ children, className = "", variant = "standard", hoverable = false, ...props }, ref) => {
    const glassClass = {
      subtle: "glass-subtle",
      standard: "glass-standard",
      elevated: "glass-elevated",
    };

    const hoverClass = hoverable
      ? "hover:border-white/15 hover:shadow-2xl hover:shadow-black/40 transition-all duration-180 ease-out active:scale-[0.99]"
      : "";

    return (
      <div
        ref={ref}
        className={`${glassClass[variant]} rounded-xl p-5 ${hoverClass} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassPanel.displayName = "GlassPanel";
