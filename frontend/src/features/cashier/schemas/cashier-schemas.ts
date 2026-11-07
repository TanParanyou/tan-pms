import { z } from "zod";
import { moneyAmountSchema } from "@/lib/validators";

export const openShiftSchema = z.object({
  openingFloatCash: moneyAmountSchema,
});
export type OpenShiftFormValues = z.infer<typeof openShiftSchema>;

/** Variance is counted - expected; any non-zero variance (at satang precision) requires a remark. */
export function calcVariance(expected: number | null | undefined, counted: number): number | null {
  if (expected == null) return null;
  return Math.round((counted - expected) * 100) / 100;
}

export function createCloseShiftSchema(expectedDrawerCash: number | null | undefined) {
  return z
    .object({
      actualCashCounted: moneyAmountSchema,
      varianceRemark: z.string().trim().optional(),
    })
    .refine(
      (v) => {
        const variance = calcVariance(expectedDrawerCash, v.actualCashCounted);
        return variance === null || variance === 0 || Boolean(v.varianceRemark);
      },
      { path: ["varianceRemark"], message: "Variance remark is required" }
    );
}
export type CloseShiftFormValues = z.infer<ReturnType<typeof createCloseShiftSchema>>;

export const reconcileShiftSchema = z.object({
  remark: z.string().trim().optional(),
});
export type ReconcileShiftFormValues = z.infer<typeof reconcileShiftSchema>;
