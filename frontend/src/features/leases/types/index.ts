import type { components } from "@/generated/api/tan-pms.v1";

type Schemas = components["schemas"];

export type LeaseItemDto = Schemas["LeaseItemDto"];
export type CustomerListResponse = Schemas["CustomerListResponse"];
export type LeaseListResponse = Schemas["LeaseListResponse"];
export type LeaseSettlementDto = Schemas["LeaseSettlementDto"];
export type CreateLeaseRequest = Schemas["CreateLeaseRequest"];
export type LeaseOccupantRequest = Schemas["LeaseOccupantRequest"];
export type LeaseVehicleRequest = Schemas["LeaseVehicleRequest"];
export type RenewLeaseRequest = Schemas["RenewLeaseRequest"];
export type SettleLeaseMoveOutRequest = Schemas["SettleLeaseMoveOutRequest"];
export type LeaseStatusType =
  | "Draft"
  | "PendingSignature"
  | "Active"
  | "MoveOutNotice"
  | "MovedOut"
  | "Terminated"
  | "Cancelled";
export type UpdateLeaseRequest = Schemas["UpdateLeaseRequest"];
export type UpdateLeaseOccupantRequest = Schemas["UpdateLeaseOccupantRequest"];
export type LeaseOccupantDto = Schemas["LeaseOccupantDto"];
export type LeaseVehicleDto = Schemas["LeaseVehicleDto"];
