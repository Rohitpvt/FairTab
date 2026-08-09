import * as zod from "zod";

export const groupSchema = zod.object({
  name: zod
    .string()
    .min(1, "Group name is required.")
    .max(50, "Group name must be 50 characters or less."),
  description: zod
    .string()
    .max(200, "Description must be 200 characters or less.")
    .optional(),
  type: zod.enum(["trip", "home", "couple", "event", "project", "other"]),
  baseCurrency: zod.string().min(1, "Base currency is required."),
  simplifyDebts: zod.boolean().default(true),
  settlementStrategy: zod.enum(["minimum_transactions", "preserve_relationships"]).default("minimum_transactions"),
});

export type GroupFormData = zod.infer<typeof groupSchema>;

export interface GroupDocument {
  id: string;
  name: string;
  nameLower: string;
  description?: string;
  type: "trip" | "home" | "couple" | "event" | "project" | "other";
  baseCurrency: string;
  ownerUserId: string;
  memberUserIds: string[];
  activeMemberCount: number;
  simplifyDebts: boolean;
  settlementStrategy: "minimum_transactions" | "preserve_relationships";
  status: "active" | "archived" | "deleted";
  latestActivityAt: unknown; // Firestore serverTimestamp
  createdAt: unknown; // Firestore serverTimestamp
  createdBy: string;
  updatedAt: unknown; // Firestore serverTimestamp
  updatedBy: string;
  version: number;
  schemaVersion: number;
  initialActivityId?: string;
}
