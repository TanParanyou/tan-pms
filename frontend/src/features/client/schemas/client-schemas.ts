import { z } from "zod";

export const leaseIntentSchema = z.object({
  intentType: z.enum(["Renew", "MoveOut"]),
  desiredDate: z.string().min(1, "Desired date is required"),
  note: z.string().trim().optional(),
});
export type LeaseIntentFormValues = z.infer<typeof leaseIntentSchema>;

/** Amount must be positive and never exceed what is still outstanding on the invoice. */
export function buildSlipSchema(outstanding: number) {
  return z.object({
    amount: z
      .number({ message: "Amount is required" })
      .positive("Amount must be greater than zero")
      .max(outstanding, "Amount exceeds outstanding balance"),
    transferReference: z.string().trim().optional(),
    transferredAt: z.string().optional(),
  });
}
export type SlipFormValues = z.infer<ReturnType<typeof buildSlipSchema>>;

export const clientWorkOrderSchema = z.object({
  unitId: z.string().min(1, "Please select a unit"),
  issueSummary: z.string().trim().min(3, "Issue summary is required"),
  description: z.string().trim().optional(),
  priority: z.enum(["Low", "Normal", "High", "Urgent"]),
});
export type ClientWorkOrderFormValues = z.infer<typeof clientWorkOrderSchema>;
