import * as zod from "zod";

export const registerSchema = zod
  .object({
    displayName: zod
      .string()
      .min(1, "Display name is required.")
      .max(50, "Display name must be under 50 characters."),
    email: zod
      .string()
      .min(1, "Email is required.")
      .email("The email address is not formatted correctly."),
    password: zod
      .string()
      .min(1, "Password is required.")
      .min(6, "Password must be at least 6 characters."),
    confirmPassword: zod
      .string()
      .min(1, "Confirm password is required."),
    rememberDevice: zod.boolean()
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"]
  });

export type RegisterFormData = zod.infer<typeof registerSchema>;
