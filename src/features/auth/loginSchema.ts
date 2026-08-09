import * as zod from "zod";

export const loginSchema = zod.object({
  email: zod
    .string()
    .min(1, "Email is required.")
    .email("The email address is not formatted correctly."),
  password: zod
    .string()
    .min(1, "Password is required.")
    .min(6, "Password must be at least 6 characters."),
  rememberDevice: zod.boolean()
});

export type LoginFormData = zod.infer<typeof loginSchema>;
