import type { BadgeProps } from "@/components/ui/badge";
import type { HousekeepingStatusType } from "./types";

export const PERMISSION_HOUSEKEEPING_UPDATE = "admin.housekeeping.update";

export const HOUSEKEEPING_STATUS_OPTIONS: readonly HousekeepingStatusType[] = [
  "Pending",
  "Cleaning",
  "Inspecting",
  "Completed",
];

export const HOUSEKEEPING_STATUS_BADGE_VARIANT: Record<HousekeepingStatusType, NonNullable<BadgeProps["variant"]>> = {
  Pending: "warning",
  Cleaning: "default",
  Inspecting: "secondary",
  Completed: "success",
};

export const HOUSEKEEPING_EMPTY_CREATE = { unitId: "", note: "", assignedStaffUserId: "" };
