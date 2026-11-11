import { z } from "zod";

/** Mirrors the backend password policy (auth.password_policy): minimum length only. */
export const PASSWORD_MIN_LENGTH = 10;

export const newPasswordSchema = z.string().min(PASSWORD_MIN_LENGTH);

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: newPasswordSchema,
    confirmPassword: z.string().min(1),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"] });

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

export const setPasswordSchema = z.object({
  identifier: z.string().trim(),
  password: newPasswordSchema,
});

export type SetPasswordFormValues = z.infer<typeof setPasswordSchema>;
