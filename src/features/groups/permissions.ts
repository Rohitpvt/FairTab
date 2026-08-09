export type UserRole = "owner" | "admin" | "member" | "viewer";

export const canEditSettings = (role: UserRole): boolean => {
  return role === "owner" || role === "admin";
};

export const canArchiveGroup = (role: UserRole): boolean => {
  return role === "owner";
};

export const canInviteMember = (role: UserRole): boolean => {
  return role === "owner" || role === "admin";
};

export const canAddPlaceholder = (role: UserRole): boolean => {
  return role === "owner" || role === "admin";
};

export const canLeaveGroup = (role: UserRole): boolean => {
  // Owners cannot leave groups directly (must transfer ownership first, which is deferred, or archive group)
  return role !== "owner";
};

export const canRemoveMember = (currentUserRole: UserRole, targetUserRole: UserRole): boolean => {
  if (currentUserRole === "owner") {
    // Owner can remove anyone except themselves
    return targetUserRole !== "owner";
  }
  if (currentUserRole === "admin") {
    // Admin can only remove ordinary members and viewers (cannot remove owner or other admins)
    return targetUserRole === "member" || targetUserRole === "viewer";
  }
  return false;
};

export const canChangeRole = (
  currentUserRole: UserRole,
  targetUserRole: UserRole,
  proposedRole: UserRole,
  isSelf: boolean
): boolean => {
  if (isSelf) return false; // Cannot modify own role
  if (targetUserRole === "owner") return false; // Owner role is immutable, cannot demote owner
  if (proposedRole === "owner") return false; // Ownership transfer is deferred (no promoting anyone to owner)

  if (currentUserRole === "owner") {
    // Owner can change any role except owner
    return proposedRole === "admin" || proposedRole === "member" || proposedRole === "viewer";
  }
  if (currentUserRole === "admin") {
    // Admin can only transition member ↔ viewer (cannot change owner or other admins, cannot promote anyone to admin)
    if (targetUserRole !== "member" && targetUserRole !== "viewer") return false;
    return proposedRole === "member" || proposedRole === "viewer";
  }
  return false;
};
