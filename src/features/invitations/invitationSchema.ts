import * as zod from "zod";

export const invitationSchema = zod.object({
  email: zod
    .string()
    .min(1, "Email is required.")
    .email("The email address is not formatted correctly."),
  proposedRole: zod.enum(["admin", "member", "viewer"]),
});

export type InvitationFormData = zod.infer<typeof invitationSchema>;

export interface InvitationDocument {
  id: string;
  groupId: string;
  groupName: string;
  invitedEmailLower?: string;
  invitedUserId?: string;
  invitedBy: string;
  proposedRole: "admin" | "member" | "viewer";
  status: "pending" | "accepted" | "declined" | "revoked" | "expired";
  createdAt: unknown; // Firestore serverTimestamp
  expiresAt: unknown; // Firestore timestamp
  acceptedAt?: unknown; // Firestore serverTimestamp
  acceptedBy?: string;
  acceptedActivityId?: string;
}
