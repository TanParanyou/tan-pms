import { z } from "zod";
import {
  moneyAmountSchema,
  positiveMoneySchema,
  identityDocumentSchema,
  licensePlateSchema,
} from "@/lib/validators";

const occupantSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required"),
  nationalityCode: z.string().trim().min(2, "Nationality is required"),
  identityNumber: identityDocumentSchema,
  isPrimaryOccupant: z.boolean(),
});

const vehicleSchema = z.object({
  licensePlate: licensePlateSchema,
  province: z.string().trim().optional(),
  vehicleBrandModel: z.string().trim().optional(),
});

export const leaseCreateSchema = z
  .object({
    unitId: z.string().min(1, "Please select a unit"),
    customerId: z.string().min(1, "Please select a customer"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    monthlyRentAmount: positiveMoneySchema,
    securityDepositAmount: moneyAmountSchema,
    paymentMethod: z.enum(["Cash", "BankTransfer", "PromptPay"]),
    initialWaterMeterReading: z.number().finite().nonnegative(),
    initialElectricMeterReading: z.number().finite().nonnegative(),
    occupants: z.array(occupantSchema),
    vehicles: z.array(vehicleSchema),
  })
  .refine((v) => v.endDate > v.startDate, {
    path: ["endDate"],
    message: "End date must be after start date",
  });

export type LeaseCreateFormValues = z.infer<typeof leaseCreateSchema>;

export const leaseOccupantSchema = occupantSchema;
export type LeaseOccupantFormValues = z.infer<typeof leaseOccupantSchema>;

export const leaseVehicleSchema = vehicleSchema;
export type LeaseVehicleFormValues = z.infer<typeof leaseVehicleSchema>;

export const leaseRenewSchema = z.object({
  newEndDate: z.string().min(1, "End date is required"),
  newMonthlyRentAmount: positiveMoneySchema,
});
export type LeaseRenewFormValues = z.infer<typeof leaseRenewSchema>;

export const leaseSettleSchema = z.object({
  utilityDeductionAmount: moneyAmountSchema,
  damageDeductionAmount: moneyAmountSchema,
  refundPaymentMethod: z.enum(["Cash", "BankTransfer", "PromptPay"]),
  reason: z.string().trim().min(3, "Reason is required"),
});
export type LeaseSettleFormValues = z.infer<typeof leaseSettleSchema>;

export const leaseEditSchema = z.object({
  monthlyRentAmount: positiveMoneySchema,
  initialWaterMeterReading: z.number().finite().nonnegative(),
  initialElectricMeterReading: z.number().finite().nonnegative(),
  reason: z.string().trim().min(3, "Reason is required"),
});
export type LeaseEditFormValues = z.infer<typeof leaseEditSchema>;

/** Identity number is write-only (API returns it masked), so blank means keep the stored value. */
export const leaseOccupantEditSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required"),
  nationalityCode: z.string().trim().min(2, "Nationality is required"),
  identityNumber: z.union([z.literal(""), identityDocumentSchema]),
  isPrimaryOccupant: z.boolean(),
});
export type LeaseOccupantEditFormValues = z.infer<typeof leaseOccupantEditSchema>;
