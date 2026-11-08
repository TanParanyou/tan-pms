import type { BadgeProps } from "@/components/ui/badge";
import type { ParcelStatusType } from "./types";

export const PERMISSION_PARCELS_MANAGE = "admin.parcels.manage";

export const PARCEL_STATUS_OPTIONS: readonly ParcelStatusType[] = ["Arrived", "PickedUp"];

export const PARCEL_STATUS_BADGE_VARIANT: Record<ParcelStatusType, NonNullable<BadgeProps["variant"]>> = {
  Arrived: "warning",
  PickedUp: "success",
};

export const PARCEL_FORM_DEFAULTS = { unitId: "", carrierName: "", trackingNumber: "", photoFileKey: "" };
