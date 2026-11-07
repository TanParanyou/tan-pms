import { z } from "zod";
import { moneyAmountSchema } from "@/lib/validators";

export const createReservationSchema = z.object({
  unitTypeId: z.string().min(1, "Please select a unit type"),
  stayMode: z.enum(["Hourly", "Daily", "Monthly"]),
  checkIn: z.string().min(10, "Check-in date is required"),
  checkOut: z.string().min(10, "Check-out date is required"),
  customerName: z.string().min(2, "Full name is required"),
  customerPhone: z.string().min(9, "Phone number is required"),
  customerEmail: z.string().email("Valid email is required"),
  depositAmount: moneyAmountSchema,
  specialRequests: z.string().optional(),
});

export type CreateReservationFormValues = z.infer<typeof createReservationSchema>;

export const assignUnitSchema = z.object({
  unitId: z.string().min(1, "Please select a unit to assign"),
});

export type AssignUnitFormValues = z.infer<typeof assignUnitSchema>;

export const cancelReservationSchema = z.object({
  cancellationReason: z.string().min(3, "Cancellation reason must be at least 3 characters"),
});

export type CancelReservationFormValues = z.infer<typeof cancelReservationSchema>;
