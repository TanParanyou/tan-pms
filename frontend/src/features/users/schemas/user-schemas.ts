import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-policy";

export const upsertAdminUserSchema = z.object({
  username: z.string().trim().min(3, "Username must be at least 3 characters"),
  fullName: z.string().trim().min(2, "Full name is required"),
  email: z.string().trim().email("Valid email is required"),
  roleCode: z.string().min(1, "Please select a role"),
  allowedPropertyIds: z.array(z.string()).min(1, "Select at least one property"),
  isActive: z.boolean(),
  // Only meaningful on create; the editor never fills or sends it for an existing user.
  initialPassword: z.string().optional(),
});

export const createAdminUserSchema = upsertAdminUserSchema.extend({
  initialPassword: z.string().min(PASSWORD_MIN_LENGTH),
});

export type UpsertAdminUserFormValues = z.infer<typeof upsertAdminUserSchema>;
