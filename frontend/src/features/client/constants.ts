import type { BadgeProps } from "@/components/ui/badge";
import type { LeaseIntentStatusType, LeaseIntentType, SlipStatusType } from "./types";

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

export const LEASE_INTENT_TYPES: readonly LeaseIntentType[] = ["Renew", "MoveOut"];
export const LEASE_INTENT_STATUS_OPTIONS: readonly LeaseIntentStatusType[] = [
  "Pending",
  "Approved",
  "Rejected",
  "Withdrawn",
];
export const DEFAULT_ADMIN_INTENT_STATUS: LeaseIntentStatusType = "Pending";

export const INTENT_STATUS_BADGE_VARIANT: Record<LeaseIntentStatusType, BadgeVariant> = {
  Pending: "warning",
  Approved: "success",
  Rejected: "destructive",
  Withdrawn: "outline",
};

export const SLIP_STATUS_BADGE_VARIANT: Record<SlipStatusType, BadgeVariant> = {
  Pending: "warning",
  Approved: "success",
  Rejected: "destructive",
  Withdrawn: "outline",
};

export const CLIENT_INVOICE_STATUS_OPTIONS: readonly string[] = ["Issued", "PartiallyPaid", "Overdue", "Paid"];

export const RESERVATION_STATUS_BADGE_VARIANT: Record<string, BadgeVariant> = {
  Hold: "warning",
  PendingVerification: "default",
  Confirmed: "success",
  CheckedIn: "success",
  Expired: "outline",
  Cancelled: "outline",
  NoShow: "destructive",
};

export const UTILITY_MONTH_OPTIONS: readonly number[] = [6, 12, 24];
export const DEFAULT_UTILITY_MONTHS = 12;

export const CLIENT_STAY_MODES = ["Hourly", "Daily", "Monthly"] as const;
export const DEFAULT_CLIENT_STAY_MODE = "Daily";

export const CLIENT_WORK_ORDER_PRIORITIES = ["Low", "Normal", "High", "Urgent"] as const;
export const CLIENT_WORK_ORDER_DEFAULTS = {
  unitId: "",
  issueSummary: "",
  description: "",
  priority: "Normal" as (typeof CLIENT_WORK_ORDER_PRIORITIES)[number],
};

export const CLIENT_SLIP_DEFAULTS = { amount: 0, transferReference: "", transferredAt: "" };
export const CLIENT_INTENT_DEFAULTS = { intentType: "Renew" as LeaseIntentType, desiredDate: "", note: "" };
export const HOLD_TTL_FALLBACK_SECONDS = 15 * 60;
