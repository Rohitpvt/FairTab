import React from "react";
import { GlassPanel } from "./GlassPanel";

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    positive: boolean;
  };
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  trend,
  className = "",
  ...props
}) => {
  return (
    <GlassPanel variant="standard" className={`flex flex-col gap-2 ${className}`} {...props}>
      <div className="flex items-center justify-between text-text-muted text-xs font-semibold tracking-wider uppercase">
        <span>{label}</span>
        {icon && <span className="text-text-secondary">{icon}</span>}
      </div>
      <div className="text-2xl font-bold tracking-tight text-text-primary financial-number">
        {value}
      </div>
      {trend && (
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <span className={trend.positive ? "text-success" : "text-danger"}>
            {trend.positive ? "+" : "-"}
            {trend.value}
          </span>
          <span className="text-text-muted">vs last month</span>
        </div>
      )}
    </GlassPanel>
  );
};
