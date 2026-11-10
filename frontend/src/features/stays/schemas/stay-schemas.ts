import { z } from "zod";
import { moneyAmountSchema, positiveMoneySchema } from "@/lib/validators";

export const stayCreateSchema = z.object({
  unitId: z.string().min(1, "Please select a unit"),
  customerId: z.string().min(1, "Please select a customer"),
  stayMode: z.enum(["Hourly", "Daily"]),
  durationHours: z.number().int().min(1).max(24),
  durationDays: z.number().int().min(1).max(30),
  dirtyOverrideReason: z.string().optional(),
  primaryGuestName: z.string().trim().min(2, "Full name is required"),
  primaryNationality: z.string().trim().min(2, "Nationality is required"),
  primaryIdNumber: z.string().trim().min(5, "ID or Passport is required"),
  primaryPhoneNumber: z.string().trim().optional(),
  primaryLicensePlate: z.string().optional(),
  keyDepositAmount: moneyAmountSchema,
});
export type StayCreateFormValues = z.infer<typeof stayCreateSchema>;

export const extendStaySchema = z.object({
  additionalHours: z.number().int().min(1).max(8),
});
export type ExtendStayFormValues = z.infer<typeof extendStaySchema>;

export const folioChargeSchema = z.object({
  descriptionTh: z.string().trim().min(1, "Description (TH) is required"),
  descriptionEn: z.string().trim().optional(),
  amount: positiveMoneySchema,
  taxMode: z.enum(["VatIncluded", "VatExcluded", "Exempt"]),
});
export type FolioChargeFormValues = z.infer<typeof folioChargeSchema>;

export const folioPaymentSchema = z.object({
  amount: positiveMoneySchema,
  paymentMethod: z.enum(["Cash", "BankTransfer", "PromptPay"]),
});
export type FolioPaymentFormValues = z.infer<typeof folioPaymentSchema>;

export const reversePaymentSchema = z.object({
  amount: positiveMoneySchema,
  paymentMethod: z.enum(["Cash", "BankTransfer", "PromptPay"]),
  reason: z.string().trim().min(3, "Reason is required"),
});
export type ReversePaymentFormValues = z.infer<typeof reversePaymentSchema>;

export const checkOutSchema = z.object({
  keyDepositDeduction: moneyAmountSchema,
  deductionReason: z.string().optional(),
});
export type CheckOutFormValues = z.infer<typeof checkOutSchema>;

export const updateStaySchema = z.object({
  expectedCheckOutAt: z.string().optional(),
  note: z.string().trim().optional(),
});
export type UpdateStayFormValues = z.infer<typeof updateStaySchema>;

export const occupantSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required"),
  nationalityCode: z.string().trim().min(2, "Nationality is required"),
  identityNumber: z.string().trim().optional(),
  isPrimaryOccupant: z.boolean(),
  vehicleLicensePlate: z.string().trim().optional(),
  phoneNumber: z.string().trim().optional(),
});
export type OccupantFormValues = z.infer<typeof occupantSchema>;
