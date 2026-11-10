import { z } from "zod";
import { moneyAmountSchema } from "@/lib/validators";

const stayModes = z.array(z.enum(["Hourly", "Daily", "Monthly"])).min(1, "Select at least one stay mode");

export const upsertUnitMasterSchema = z.object({
  unitNumber: z.string().trim().min(1, "Unit number is required"),
  buildingId: z.string().min(1, "Please select a building"),
  floorId: z.string().min(1, "Please select a floor"),
  unitTypeId: z.string().min(1, "Please select a unit type"),
  supportedStayModes: stayModes,
  conditionStatus: z.enum(["Clean", "Dirty", "Cleaning", "Inspecting", "OutOfOrder"]),
  assets: z.array(
    z.object({
      assetCode: z.string().trim().min(1, "Asset code is required"),
      nameTh: z.string().trim().min(1, "Thai name is required"),
      nameEn: z.string().trim().optional(),
      replacementCostAmount: moneyAmountSchema,
    })
  ),
});
export type UpsertUnitMasterFormValues = z.infer<typeof upsertUnitMasterSchema>;

export const buildingSchema = z.object({
  code: z.string().trim().min(1, "Code is required"),
  nameTh: z.string().trim().min(1, "Thai name is required"),
  nameEn: z.string().trim().optional(),
});
export type BuildingFormValues = z.infer<typeof buildingSchema>;

export const floorSchema = z.object({
  buildingId: z.string().min(1, "Please select a building"),
  floorNumber: z.number().int(),
  nameTh: z.string().trim().min(1, "Thai name is required"),
  nameEn: z.string().trim().optional(),
});
export type FloorFormValues = z.infer<typeof floorSchema>;

export const unitTypeSchema = z.object({
  code: z.string().trim().min(1, "Code is required"),
  nameTh: z.string().trim().min(1, "Thai name is required"),
  nameEn: z.string().trim().optional(),
  descriptionTh: z.string().trim().optional(),
  descriptionEn: z.string().trim().optional(),
  areaSqm: z.number().positive("Area must be greater than zero"),
  totalQuotaUnits: z.number().int().min(0),
  supportedStayModes: stayModes,
  hourlyBasePackagePrice: moneyAmountSchema,
  hourlyBasePackageHours: z.number().int().min(1),
  hourlyAdditionalHourPrice: moneyAmountSchema,
  dailyRate: moneyAmountSchema,
  monthlyRentRate: moneyAmountSchema,
});
export type UnitTypeFormValues = z.infer<typeof unitTypeSchema>;
