import { z } from "zod";

export const parcelFormSchema = z.object({
  unitId: z.string().min(1, "Please select a unit"),
  carrierName: z.string().trim().min(2, "Carrier is required"),
  trackingNumber: z.string().trim().optional(),
  photoFileKey: z.string().trim().optional(),
});
export type ParcelFormValues = z.infer<typeof parcelFormSchema>;

export const parcelPickupSchema = z.object({
  recipientName: z.string().trim().optional(),
});
export type ParcelPickupFormValues = z.infer<typeof parcelPickupSchema>;
