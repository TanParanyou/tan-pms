import type { BadgeProps } from "@/components/ui/badge";
import type { CashierShiftStatusType } from "./types";

export const PERMISSION_CASHIER_OPERATE = "admin.cashier.operate_shift";
export const PERMISSION_CASHIER_RECONCILE = "admin.cashier.reconcile_shift";

export const SHIFT_STATUS_OPTIONS: readonly CashierShiftStatusType[] = ["Open", "Closed", "Reconciled", "Cancelled"];

export const SHIFT_STATUS_BADGE_VARIANT: Record<CashierShiftStatusType, NonNullable<BadgeProps["variant"]>> = {
  Open: "success",
  Closed: "warning",
  Reconciled: "outline",
  Cancelled: "destructive",
};
