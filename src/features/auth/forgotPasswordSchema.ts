import * as zod from "zod";

export const forgotPasswordSchema = zod.object({
  email: zod
    .string()
    .min(1, "Email is required.")
    .email("The email address is not formatted correctly.")
});

export type ForgotPasswordFormData = zod.infer<typeof forgotPasswordSchema>;
