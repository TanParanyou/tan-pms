import type { components } from "@/generated/api/tan-pms.v1";
import type { ClientDashboardResponse } from "@/generated/api";

type Schemas = components["schemas"];

export type { ClientDashboardResponse };

export type LeaseIntentDto = Schemas["LeaseIntentDto"];
export type LeaseIntentListResponse = Schemas["LeaseIntentListResponse"];
export type CreateLeaseIntentRequest = Schemas["CreateLeaseIntentRequest"];
export type UpdateLeaseIntentRequest = Schemas["UpdateLeaseIntentRequest"];
export type ClientInvoiceDto = Schemas["ClientInvoiceDto"];
export type ClientInvoiceListResponse = Schemas["ClientInvoiceListResponse"];
export type ClientPaymentSlipDto = Schemas["ClientPaymentSlipDto"];
export type ClientPaymentSlipListResponse = Schemas["ClientPaymentSlipListResponse"];
export type SubmitPaymentSlipRequest = Schemas["SubmitPaymentSlipRequest"];
export type ClientUtilityUsageResponse = Schemas["ClientUtilityUsageResponse"];
export type UtilityUsageMonthDto = Schemas["UtilityUsageMonthDto"];
export type OccupancyReportDto = Schemas["OccupancyReportDto"];
export type RevParReportDto = Schemas["RevParReportDto"];
export type AgingReportDto = Schemas["AgingReportDto"];
export type CashierShiftSummaryDto = Schemas["CashierShiftSummaryDto"];
export type DepositSummaryDto = Schemas["DepositSummaryDto"];

export type LeaseIntentType = "Renew" | "MoveOut";
export type LeaseIntentStatusType = "Pending" | "Approved" | "Rejected" | "Withdrawn";
export type SlipStatusType = "Pending" | "Approved" | "Rejected" | "Withdrawn";
export type AnalyticsReportKind = "occupancy" | "revpar" | "receivables-aging" | "cashier-shifts" | "deposits";
export type AgingBucketsDto = Schemas["AgingBucketsDto"];
export type UpsertBuildingRequest = Schemas["UpsertBuildingRequest"];
export type BuildingDetailDto = Schemas["BuildingDetailDto"];
export type UpsertFloorRequest = Schemas["UpsertFloorRequest"];
export type FloorDetailDto = Schemas["FloorDetailDto"];
export type UpsertUnitTypeRequest = Schemas["UpsertUnitTypeRequest"];
export type UnitTypeDetailDto = Schemas["UnitTypeDetailDto"];
export type UpdateReservationRequest = Schemas["UpdateReservationRequest"];
export type UpdateStayRequest = Schemas["UpdateStayRequest"];
export type UpdateStayOccupantRequest = Schemas["UpdateStayOccupantRequest"];
export type ReverseFolioPaymentRequest = Schemas["ReverseFolioPaymentRequest"];
export type CheckInOccupantInputDto = Schemas["CheckInOccupantInputDto"];
