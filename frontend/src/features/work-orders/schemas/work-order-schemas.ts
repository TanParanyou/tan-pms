import { z } from "zod";
import { moneyAmountSchema } from "@/lib/validators";

export const workOrderFormSchema = z.object({
  unitId: z.string().min(1, "Please select a unit"),
  issueSummary: z.string().trim().min(3, "Issue summary is required"),
  description: z.string().trim().optional(),
  priority: z.enum(["Low", "Normal", "High", "Urgent"]),
  beforePhotoFileKey: z.string().trim().optional(),
});
export type WorkOrderFormValues = z.infer<typeof workOrderFormSchema>;

export const workOrderAssignSchema = z.object({
  technicianUserId: z.string().min(1, "Please select a technician"),
});
export type WorkOrderAssignFormValues = z.infer<typeof workOrderAssignSchema>;

export const workOrderResolveSchema = z.object({
  resolutionNotes: z.string().trim().min(3, "Resolution notes are required"),
  afterPhotoFileKey: z.string().trim().optional(),
  repairCostAmount: moneyAmountSchema,
  chargeToTenant: z.boolean(),
});
export type WorkOrderResolveFormValues = z.infer<typeof workOrderResolveSchema>;
