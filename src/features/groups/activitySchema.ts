export interface ActivityDocument {
  id: string;
  groupId: string;
  type:
    | "group_created"
    | "group_updated"
    | "member_invited"
    | "member_joined"
    | "member_removed"
    | "member_left"
    | "placeholder_added"
    | "role_changed"
    | "group_archived"
    | "expense_created"
    | "expense_updated"
    | "expense_voided";
  actorUserId: string;
  entityType?: "group" | "member" | "expense" | "settlement";
  entityId?: string;
  summary: string;
  createdAt: unknown; // Firestore serverTimestamp
}
