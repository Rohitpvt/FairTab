import React from "react";
import { Compass, Home, Heart, Calendar, Briefcase, Layers } from "lucide-react";
import { GlassPanel } from "./GlassPanel";
import { AvatarGroup } from "./Avatar";
import { formatCurrency } from "../../utils/format";

export interface GroupCardProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  type: "trip" | "home" | "couple" | "event" | "project" | "other";
  baseCurrency?: string;
  balance: number;
  members: Array<{ name: string; avatarUrl?: string }>;
  lastActivity: string;
  onClick?: () => void;
}

export const GroupCard: React.FC<GroupCardProps> = ({
  name,
  type,
  baseCurrency = "INR",
  balance,
  members,
  lastActivity,
  onClick,
  className = "",
  ...props
}) => {
  const getIcon = () => {
    switch (type) {
      case "trip":
        return <Compass className="h-5 w-5" />;
      case "home":
        return <Home className="h-5 w-5" />;
      case "couple":
        return <Heart className="h-5 w-5" />;
      case "event":
        return <Calendar className="h-5 w-5" />;
      case "project":
        return <Briefcase className="h-5 w-5" />;
      default:
        return <Layers className="h-5 w-5" />;
    }
  };

  const getBalanceText = () => {
    if (balance > 0) {
      return (
        <div className="text-right">
          <p className="text-[10px] text-text-muted uppercase font-semibold">You are owed</p>
          <p className="text-sm font-bold text-success financial-number">
            {formatCurrency(balance, baseCurrency)}
          </p>
        </div>
      );
    }
    if (balance < 0) {
      return (
        <div className="text-right">
          <p className="text-[10px] text-text-muted uppercase font-semibold">You owe</p>
          <p className="text-sm font-bold text-danger financial-number">
            {formatCurrency(Math.abs(balance), baseCurrency)}
          </p>
        </div>
      );
    }
    return (
      <div className="text-right">
        <p className="text-[10px] text-text-muted uppercase font-semibold">Status</p>
        <p className="text-sm font-semibold text-text-muted">Settled Up</p>
      </div>
    );
  };

  return (
    <GlassPanel
      variant="standard"
      hoverable={!!onClick}
      onClick={onClick}
      className={`flex flex-col gap-4 p-5 cursor-pointer select-none transition-all ${className}`}
      {...props}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg glass-subtle text-accent-cyan">{getIcon()}</div>
          <div>
            <h3 className="text-base font-semibold text-text-primary leading-tight">{name}</h3>
            <span className="text-xs text-text-muted capitalize">{type}</span>
          </div>
        </div>
        {getBalanceText()}
      </div>

      <div className="flex items-center justify-between mt-2 pt-3 border-t border-white/5">
        <AvatarGroup members={members} max={3} />
        <span className="text-xs text-text-muted" aria-label={`Last active ${lastActivity}`}>
          {lastActivity}
        </span>
      </div>
    </GlassPanel>
  );
};
