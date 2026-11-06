import type { components, paths } from "./tan-pms.v1";

export type Schemas = components["schemas"];
export type RoomRackResponse = Schemas["RoomRackResponse"];
export type RoomRackItemDto = Schemas["RoomRackItemDto"];
export type UnitRefDto = Schemas["UnitRefDto"];
export type CustomerRefDto = Schemas["CustomerRefDto"];
export type PropertyRefDto = Schemas["PropertyRefDto"];
export type CheckInStayRequest = Schemas["CheckInStayRequest"];
export type StaySummaryDto = Schemas["StaySummaryDto"];
export type ClientDashboardResponse = Schemas["ClientDashboardResponse"];
export type ProblemDetailsResponse = Schemas["ProblemDetailsResponse"];
export type LocalizedTextDto = Schemas["LocalizedTextDto"];
export type LoginRequest = Schemas["LoginRequest"];
export type AuthSessionResponse = Schemas["AuthSessionResponse"];
export type RoleDefinitionDto = Schemas["RoleDefinitionDto"];
export type PermissionDefinitionDto = Schemas["PermissionDefinitionDto"];
export type RoleCatalogResponse = Schemas["RoleCatalogResponse"];
export type AdminUserDto = Schemas["AdminUserDto"];
export type AdminUserListResponse = Schemas["AdminUserListResponse"];
export type UpsertAdminUserRequest = Schemas["UpsertAdminUserRequest"];
export type DispatchNotificationRequest = Schemas["DispatchNotificationRequest"];
export type NotificationItemDto = Schemas["NotificationItemDto"];
export type NotificationListResponse = Schemas["NotificationListResponse"];

export type { paths };
