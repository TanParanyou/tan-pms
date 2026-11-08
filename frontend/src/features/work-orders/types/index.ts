import type { components } from "@/generated/api/tan-pms.v1";

type Schemas = components["schemas"];

export type WorkOrderItemDto = Schemas["WorkOrderItemDto"];
export type WorkOrderListResponse = Schemas["WorkOrderListResponse"];
export type CreateWorkOrderRequest = Schemas["CreateWorkOrderRequest"];
export type UpdateWorkOrderRequest = Schemas["UpdateWorkOrderRequest"];
export type AssignWorkOrderRequest = Schemas["AssignWorkOrderRequest"];
export type ResolveWorkOrderRequest = Schemas["ResolveWorkOrderRequest"];
export type WorkOrderStatusType = "Open" | "InProgress" | "Completed" | "Cancelled";
export type WorkOrderPriorityType = "Low" | "Normal" | "High" | "Urgent";
