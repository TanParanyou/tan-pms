import { z } from "zod";

const readingString = z
  .string()
  .trim()
  .min(1, "Reading is required")
  .refine((v) => Number.isFinite(Number(v)) && Number(v) >= 0, "Reading must be a non-negative number");

export const meterRowEditSchema = z.object({
  water: readingString,
  electric: readingString,
  waterRollover: z.boolean(),
  electricRollover: z.boolean(),
});
export type MeterRowEdit = z.infer<typeof meterRowEditSchema>;

export const meterSaveSchema = z
  .object({
    rows: z.array(meterRowEditSchema).min(1, "Nothing to save"),
    hasLockedEdit: z.boolean(),
    overrideReason: z.string().trim().optional(),
  })
  .refine((v) => !v.hasLockedEdit || Boolean(v.overrideReason), {
    path: ["overrideReason"],
    message: "Override reason is required",
  });
