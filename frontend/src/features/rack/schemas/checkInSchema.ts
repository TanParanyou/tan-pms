import { z } from "zod";

export const checkInSchema = z
  .object({
    guestName: z.string().min(1, "Guest name is required"),
    guestId: z.string().min(1, "National ID or Passport is required"),
    phone: z.string().optional(),
    selectedUnitId: z.string().min(1, "Unit selection is required"),
    stayMode: z.enum(["Hourly", "Daily", "Monthly"]),
    keyDepositAmount: z.string().min(1, "Key deposit amount is required"),
    overrideDirty: z.boolean().default(false),
    overrideReason: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.overrideDirty && (!data.overrideReason || data.overrideReason.trim().length === 0)) {
        return false;
      }
      return true;
    },
    {
      message: "Override reason is required when checking into uncleaned unit",
      path: ["overrideReason"],
    }
  );

export type CheckInSchemaType = z.infer<typeof checkInSchema>;
