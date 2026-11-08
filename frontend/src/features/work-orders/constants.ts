import type { BadgeProps } from "@/components/ui/badge";
import type { WorkOrderPriorityType, WorkOrderStatusType } from "./types";

export const PERMISSION_WORK_ORDERS_MANAGE = "admin.workorders.manage";

export const WORK_ORDER_STATUS_OPTIONS: readonly WorkOrderStatusType[] = [
  "Open",
  "InProgress",
  "Completed",
  "Cancelled",
];

export const WORK_ORDER_PRIORITY_OPTIONS: readonly WorkOrderPriorityType[] = ["Low", "Normal", "High", "Urgent"];

export const WORK_ORDER_STATUS_BADGE_VARIANT: Record<WorkOrderStatusType, NonNullable<BadgeProps["variant"]>> = {
  Open: "warning",
  InProgress: "default",
  Completed: "success",
  Cancelled: "outline",
};

export const WORK_ORDER_PRIORITY_BADGE_VARIANT: Record<WorkOrderPriorityType, NonNullable<BadgeProps["variant"]>> = {
  Low: "secondary",
  Normal: "outline",
  High: "warning",
  Urgent: "destructive",
};

export const WORK_ORDER_FORM_DEFAULTS = {
  unitId: "",
  issueSummary: "",
  description: "",
  priority: "Normal" as WorkOrderPriorityType,
  beforePhotoFileKey: "",
};

export const WORK_ORDER_RESOLVE_DEFAULTS = {
  resolutionNotes: "",
  afterPhotoFileKey: "",
  repairCostAmount: 0,
  chargeToTenant: false,
};
