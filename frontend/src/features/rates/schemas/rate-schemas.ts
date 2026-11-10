import { z } from "zod";
import { moneyAmountSchema } from "@/lib/validators";

export const upsertRatePlanSchema = z.object({
  code: z.string().trim().min(2, "Plan code is required"),
  nameTh: z.string().trim().min(2, "Thai name is required"),
  nameEn: z.string().trim().optional(),
  unitTypeId: z.string().min(1, "Please select a unit type"),
  supportedStayModes: z.array(z.enum(["Hourly", "Daily", "Monthly"])).min(1, "Select at least one stay mode"),
  isActive: z.boolean(),
  basePackageHours: z.number().int().min(1),
  basePackagePrice: moneyAmountSchema,
  additionalHourPrice: moneyAmountSchema,
  gracePeriodMinutes: z.number().int().min(0),
  autoCapToDailyRate: moneyAmountSchema,
  turnaroundBufferMinutes: z.number().int().min(0),
  weekdayRate: moneyAmountSchema,
  weekendRate: moneyAmountSchema,
  holidaySurchargeAmount: moneyAmountSchema,
  extraGuestPrice: moneyAmountSchema,
  monthlyRentRate: moneyAmountSchema,
  minimumLeaseMonths: z.number().int().min(1),
  securityDepositMonths: z.number().int().min(0),
});
export type UpsertRatePlanFormValues = z.infer<typeof upsertRatePlanSchema>;

export const utilityTariffSchema = z.object({
  utilityType: z.enum(["Water", "Electric"]),
  nameTh: z.string().trim().min(1, "Thai name is required"),
  nameEn: z.string().trim().optional(),
  billingMode: z.enum(["PerUnit", "MinimumUnits", "FlatRate"]),
  ratePerUnit: moneyAmountSchema,
  minimumChargeAmount: moneyAmountSchema,
  includedUnits: moneyAmountSchema,
  baseMinimumAmount: moneyAmountSchema,
  flatRateAmount: moneyAmountSchema,
  flatRatePerOccupant: z.boolean(),
  meterMaxDigits: z.number().int().min(1).max(12),
});
export type UtilityTariffFormValues = z.infer<typeof utilityTariffSchema>;

export const taxProfileSchema = z.object({
  chargeCategoryCode: z.string().trim().min(1, "Category code is required"),
  nameTh: z.string().trim().min(1, "Thai name is required"),
  nameEn: z.string().trim().optional(),
  taxMode: z.enum(["Exempt", "VatIncluded", "VatExcluded"]),
  vatRatePercent: z.number().min(0).max(100),
  defaultWithholdingTaxPercent: z.number().min(0).max(100),
  isActive: z.boolean(),
});
export type TaxProfileFormValues = z.infer<typeof taxProfileSchema>;
