import * as zod from "zod";
export type { GroupDocument } from "@fairtab/domain";

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
  settlementStrategy: zod.enum(["minimum_transactions", "preserve_relationships"]).default("preserve_relationships"),
});

export type GroupFormData = zod.infer<typeof groupSchema>;
