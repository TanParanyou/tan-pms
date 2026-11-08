import { z } from "zod";
import { positiveMoneySchema } from "@/lib/validators";

export const invoiceLineSchema = z.object({
  descriptionTh: z.string().trim().min(1, "Thai description is required"),
  descriptionEn: z.string().trim().optional(),
  lineAmount: positiveMoneySchema,
  taxMode: z.enum(["Exempt", "VatIncluded", "VatExcluded"]),
});
export type InvoiceLineFormValues = z.infer<typeof invoiceLineSchema>;
