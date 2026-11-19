import * as zod from "zod";
export type { GroupMemberDocument } from "@fairtab/domain";

export const memberSchema = zod.object({
  displayName: zod
    .string()
    .min(1, "Display name is required.")
    .max(50, "Display name must be 50 characters or less."),
  role: zod.enum(["owner", "admin", "member", "viewer"]),
  status: zod.enum(["active", "invited", "removed", "left"]),
});

export type MemberFormData = zod.infer<typeof memberSchema>;
