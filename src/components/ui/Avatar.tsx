import React from "react";
import * as RadixAvatar from "@radix-ui/react-avatar";

export interface MemberAvatarProps {
  name: string;
  avatarUrl?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const MemberAvatar: React.FC<MemberAvatarProps> = ({
  name,
  avatarUrl,
  size = "md",
  className = "",
}) => {
  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
  };

  // Get initials (max 2 characters)
  const getInitials = (fullName: string) => {
    const parts = fullName.split(" ").filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <RadixAvatar.Root
      className={`inline-flex items-center justify-center align-middle overflow-hidden select-none rounded-full glass-subtle border border-white/10 ${sizeClasses[size]} ${className}`}
    >
      {avatarUrl && (
        <RadixAvatar.Image
          src={avatarUrl}
          alt={name}
          className="h-full w-full object-cover rounded-full"
        />
      )}
      <RadixAvatar.Fallback
        className="h-full w-full flex items-center justify-center font-semibold text-text-secondary bg-surface-elevated text-center uppercase"
        delayMs={200}
      >
        {getInitials(name)}
      </RadixAvatar.Fallback>
    </RadixAvatar.Root>
  );
};

export interface AvatarGroupProps {
  members: Array<{ name: string; avatarUrl?: string }>;
  max?: number;
  size?: "sm" | "md";
  className?: string;
}

export const AvatarGroup: React.FC<AvatarGroupProps> = ({
  members,
  max = 3,
  size = "sm",
  className = "",
}) => {
  const visibleMembers = members.slice(0, max);
  const remainingCount = members.length - max;

  return (
    <div className={`flex items-center -space-x-2.5 overflow-hidden ${className}`}>
      {visibleMembers.map((member, index) => (
        <MemberAvatar
          key={index}
          name={member.name}
          avatarUrl={member.avatarUrl}
          size={size}
          className="ring-2 ring-bg-base"
        />
      ))}
      {remainingCount > 0 && (
        <div
          className={`flex items-center justify-center rounded-full bg-surface-elevated text-text-muted font-bold ring-2 ring-bg-base text-[10px] sm:text-xs z-10 ${
            size === "sm" ? "h-8 w-8" : "h-10 w-10"
          }`}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
};
