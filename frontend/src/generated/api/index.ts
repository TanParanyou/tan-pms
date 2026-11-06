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

export type { paths };
