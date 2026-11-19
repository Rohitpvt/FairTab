import { useMemo } from "react";
import { useAuth } from "../features/auth/AuthProvider";
import type { GroupMemberDocument } from "@fairtab/domain";

export function resolveMemberName(
  member: GroupMemberDocument,
  currentUid: string | undefined,
  currentProfileDisplayName: string | undefined
): string {
  const memberUid = member.userId;

  // For the currently authenticated user, prefer the authoritative profile name
  if (currentUid && memberUid === currentUid && currentProfileDisplayName) {
    return currentProfileDisplayName;
  }

  // For all members (including placeholders), use the membership cached name
  if (member.displayName) {
    return member.displayName;
  }

  // Fallback
  return memberUid || "Unknown member";
}

/**
 * React hook that provides a name resolver function for group members.
 *
 * For the current authenticated user, it resolves from the live profile.
 * For other members, it resolves from the membership cache.
 *
 * Usage:
 *   const { resolveName, memberNameMap } = useMemberNameResolver(members);
 *   <span>{resolveName(member)}</span>
 */
export function useMemberNameResolver(members: GroupMemberDocument[]) {
  const { user, profile } = useAuth();
  const currentUid = user?.uid;
  const currentProfileDisplayName = profile?.displayName;

  const resolveName = useMemo(() => {
    return (member: GroupMemberDocument): string => {
      return resolveMemberName(member, currentUid, currentProfileDisplayName);
    };
  }, [currentUid, currentProfileDisplayName]);

  /**
   * A pre-built map of member.id → resolved display name.
   * Useful for components that need a Record<string, string> lookup.
   */
  const memberNameMap = useMemo(() => {
    return members.reduce((acc, m) => {
      acc[m.id] = resolveName(m);
      return acc;
    }, {} as Record<string, string>);
  }, [members, resolveName]);

  return { resolveName, memberNameMap };
}
