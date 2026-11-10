import { z } from "zod";

export const upsertAdminUserSchema = z.object({
  username: z.string().trim().min(3, "Username must be at least 3 characters"),
  fullName: z.string().trim().min(2, "Full name is required"),
  email: z.string().trim().email("Valid email is required"),
  roleCode: z.string().min(1, "Please select a role"),
  allowedPropertyIds: z.array(z.string()).min(1, "Select at least one property"),
  isActive: z.boolean(),
});

export type UpsertAdminUserFormValues = z.infer<typeof upsertAdminUserSchema>;
