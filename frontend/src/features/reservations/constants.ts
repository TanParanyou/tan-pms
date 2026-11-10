import type { BadgeProps } from "@/components/ui/badge";

export const PERMISSION_RESERVATIONS_MANAGE = "admin.reservations.manage";

export const RESERVATION_STATUS_OPTIONS = ["Hold", "PendingVerification", "Confirmed", "CheckedIn", "Expired", "Cancelled", "NoShow"] as const;
export const RESERVATION_STAY_MODES = ["Hourly", "Daily", "Monthly"] as const;

export const RESERVATION_STATUS_BADGE_VARIANT: Record<string, NonNullable<BadgeProps["variant"]>> = {
  Hold: "warning",
  PendingVerification: "default",
  Confirmed: "success",
  CheckedIn: "success",
  Expired: "outline",
  Cancelled: "outline",
  NoShow: "destructive",
};

/** Statuses that still hold quota and may be edited, assigned, confirmed or cancelled. */
export const EDITABLE_RESERVATION_STATUSES: readonly string[] = ["Hold", "PendingVerification", "Confirmed"];
export const CONFIRMABLE_RESERVATION_STATUSES: readonly string[] = ["Hold", "PendingVerification"];
export const DELETABLE_RESERVATION_STATUSES: readonly string[] = ["Expired"];

export const RESERVATION_FORM_DEFAULTS = {
  customerId: "",
  unitTypeId: "",
  unitId: "",
  stayMode: "Daily" as (typeof RESERVATION_STAY_MODES)[number],
  slotStartAt: "",
  slotEndAt: "",
  depositAmount: 0,
  guestCount: 1,
  note: "",
  confirmImmediately: false,
};
