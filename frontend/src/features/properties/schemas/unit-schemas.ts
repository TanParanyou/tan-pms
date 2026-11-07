import { z } from "zod";

export const upsertUnitMasterSchema = z.object({
  unitNumber: z.string().min(1, "Unit number is required"),
  buildingId: z.string().min(1, "Please select a building"),
  floorId: z.string().min(1, "Please select a floor"),
  unitTypeId: z.string().min(1, "Please select a unit type"),
  conditionStatus: z.enum(["Clean", "Dirty", "Cleaning", "Inspecting", "OutOfOrder"]),
  occupancyStatus: z.enum(["Vacant", "Occupied", "Reserved", "Blocked"]),
  waterMeterNumber: z.string().optional(),
  electricMeterNumber: z.string().optional(),
});

export type UpsertUnitMasterFormValues = z.infer<typeof upsertUnitMasterSchema>;
