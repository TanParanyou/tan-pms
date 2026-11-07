import { z } from "zod";
import { moneyAmountSchema } from "@/lib/validators";

export const upsertRatePlanSchema = z.object({
  code: z.string().min(2, "Plan code is required"),
  nameTh: z.string().min(2, "Thai name is required"),
  nameEn: z.string().min(2, "English name is required"),
  unitTypeId: z.string().min(1, "Please select a unit type"),
  basePackageHours: z.number().int().min(1),
  basePackagePrice: moneyAmountSchema,
  additionalHourPrice: moneyAmountSchema,
  weekdayRate: moneyAmountSchema,
  weekendRate: moneyAmountSchema,
  baseRentPrice: moneyAmountSchema,
  securityDepositMonths: z.number().int().min(1),
});

export type UpsertRatePlanFormValues = z.infer<typeof upsertRatePlanSchema>;
