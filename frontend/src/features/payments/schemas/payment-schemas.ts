import { z } from "zod";

export const rejectSlipSchema = z.object({
  reason: z.string().trim().min(3, "Reject reason is required"),
});
export type RejectSlipFormValues = z.infer<typeof rejectSlipSchema>;
