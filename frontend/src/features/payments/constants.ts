import type { BadgeProps } from "@/components/ui/badge";
import type { PaymentSlipStatusType } from "./types";

export const PERMISSION_VERIFY_SLIP = "admin.payments.verify_slip";

export const SLIP_STATUS_OPTIONS: readonly PaymentSlipStatusType[] = ["Pending", "Approved", "Rejected"];
export const DEFAULT_SLIP_STATUS: PaymentSlipStatusType = "Pending";

export const SLIP_STATUS_BADGE_VARIANT: Record<PaymentSlipStatusType, NonNullable<BadgeProps["variant"]>> = {
  Pending: "warning",
  Approved: "success",
  Rejected: "destructive",
};
