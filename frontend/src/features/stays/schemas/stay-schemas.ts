import { z } from "zod";
import { moneyAmountSchema, positiveMoneySchema } from "@/lib/validators";

export const stayCreateSchema = z.object({
  unitId: z.string().min(1, "Please select a unit"),
  stayMode: z.enum(["Hourly", "Daily"]),
  durationHours: z.number().int().min(1).max(24),
  durationDays: z.number().int().min(1).max(30),
  dirtyOverrideReason: z.string().optional(),
  primaryGuestName: z.string().min(2, "Full name is required"),
  primaryNationality: z.string().min(2, "Nationality is required"),
  primaryIdNumber: z.string().min(5, "ID or Passport is required"),
  primaryLicensePlate: z.string().optional(),
  keyDepositAmount: moneyAmountSchema,
});

export type StayCreateFormValues = z.infer<typeof stayCreateSchema>;

export const extendStaySchema = z.object({
  additionalHours: z.number().int().min(1).max(8),
});

export type ExtendStayFormValues = z.infer<typeof extendStaySchema>;

export const folioChargeSchema = z.object({
  descriptionTh: z.string().min(1, "Description (TH) is required"),
  descriptionEn: z.string().min(1, "Description (EN) is required"),
  amount: positiveMoneySchema,
  taxMode: z.enum(["VatIncluded", "VatExcluded", "Exempt"]),
});

export type FolioChargeFormValues = z.infer<typeof folioChargeSchema>;

export const folioPaymentSchema = z.object({
  amount: positiveMoneySchema,
  paymentMethod: z.enum(["Cash", "BankTransfer", "PromptPay"]),
});

export type FolioPaymentFormValues = z.infer<typeof folioPaymentSchema>;

export const checkOutSchema = z.object({
  keyDepositDeduction: moneyAmountSchema,
  deductionReason: z.string().optional(),
});

export type CheckOutFormValues = z.infer<typeof checkOutSchema>;
