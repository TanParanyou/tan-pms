import { z } from "zod";
import { moneyAmountSchema } from "@/lib/validators";

const slotRefine = (v: { slotStartAt: string; slotEndAt: string }) =>
  !v.slotStartAt || !v.slotEndAt || new Date(v.slotEndAt) > new Date(v.slotStartAt);

export const reservationFormSchema = z
  .object({
    customerId: z.string().min(1, "Please select a customer"),
    unitTypeId: z.string().min(1, "Please select a unit type"),
    unitId: z.string().optional(),
    stayMode: z.enum(["Hourly", "Daily", "Monthly"]),
    slotStartAt: z.string().min(1, "Start is required"),
    slotEndAt: z.string().min(1, "End is required"),
    depositAmount: moneyAmountSchema,
    guestCount: z.number().int().min(1).max(20),
    note: z.string().trim().optional(),
    confirmImmediately: z.boolean(),
  })
  .refine(slotRefine, { path: ["slotEndAt"], message: "End must be after start" });

export type ReservationFormValues = z.infer<typeof reservationFormSchema>;
