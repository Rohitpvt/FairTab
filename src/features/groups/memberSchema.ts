import * as zod from "zod";

export const memberSchema = zod.object({
  displayName: zod
    .string()
    .min(1, "Display name is required.")
    .max(50, "Display name must be 50 characters or less."),
  role: zod.enum(["owner", "admin", "member", "viewer"]),
  status: zod.enum(["active", "invited", "removed", "left"]),
});

export type MemberFormData = zod.infer<typeof memberSchema>;

export interface GroupMemberDocument {
  id: string; // generated ID for placeholders, UID for account-backed members
  groupId: string;
  kind: "account" | "placeholder";
  userId?: string;
  displayName: string;
  displayNameLower: string;
  avatarURL?: string;
  role: "owner" | "admin" | "member" | "viewer";
  status: "active" | "invited" | "removed" | "left";
  joinedViaInvitationId?: string;
  joinedAt?: unknown; // Firestore serverTimestamp
  createdAt: unknown; // Firestore serverTimestamp
  createdBy: string;
  updatedAt: unknown; // Firestore serverTimestamp
  updatedBy: string;
  version: number;
  schemaVersion: number;
  activityId?: string;
}
