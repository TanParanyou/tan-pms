import type { components } from "@/generated/api/tan-pms.v1";

type Schemas = components["schemas"];

export type HousekeepingTaskDto = Schemas["HousekeepingTaskDto"];
export type HousekeepingTaskListResponse = Schemas["HousekeepingTaskListResponse"];
export type CreateHousekeepingTaskRequest = Schemas["CreateHousekeepingTaskRequest"];
export type CompleteHousekeepingTaskRequest = Schemas["CompleteHousekeepingTaskRequest"];
export type AssignHousekeepingTaskRequest = Schemas["AssignHousekeepingTaskRequest"];
export type UpdateHousekeepingTaskRequest = Schemas["UpdateHousekeepingTaskRequest"];
export type HousekeepingStatusType = "Pending" | "Cleaning" | "Inspecting" | "Completed";
