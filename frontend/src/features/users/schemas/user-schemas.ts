import { z } from "zod";

export const upsertAdminUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Valid email is required"),
  roleCode: z.string().min(1, "Please select a role"),
  isActive: z.boolean(),
});

export type UpsertAdminUserFormValues = z.infer<typeof upsertAdminUserSchema>;
