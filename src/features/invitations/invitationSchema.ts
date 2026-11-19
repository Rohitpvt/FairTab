import * as zod from "zod";
export type { InvitationDocument } from "@fairtab/domain";

export const invitationSchema = zod.object({
  email: zod
    .string()
    .min(1, "Email is required.")
    .email("The email address is not formatted correctly."),
  proposedRole: zod.enum(["admin", "member", "viewer"]),
});

export type InvitationFormData = zod.infer<typeof invitationSchema>;
