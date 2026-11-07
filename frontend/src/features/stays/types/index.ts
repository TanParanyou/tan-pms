import type {
  CheckInOccupantInputDto,
  StayOccupantDto,
  FolioChargeItemDto,
  FolioSummaryDto,
  StayDetailDto,
  StayListResponse,
  ExtendStayRequest,
  AddFolioChargeRequest,
  RecordFolioPaymentRequest,
  CheckOutStayRequest,
  RegulatoryGuestRowDto,
  RegulatoryExportResponse,
  PropertyRefDto,
  UnitRefDto,
  CustomerRefDto,
  LocalizedTextDto,
  AssignableUnitOptionDto,
} from "@/generated/api";

export type {
  CheckInOccupantInputDto,
  StayOccupantDto,
  FolioChargeItemDto,
  FolioSummaryDto,
  StayDetailDto,
  StayListResponse,
  ExtendStayRequest,
  AddFolioChargeRequest,
  RecordFolioPaymentRequest,
  CheckOutStayRequest,
  RegulatoryGuestRowDto,
  RegulatoryExportResponse,
  PropertyRefDto,
  UnitRefDto,
  CustomerRefDto,
  LocalizedTextDto,
  AssignableUnitOptionDto,
};

export type StayStatusType = "Active" | "CheckedOut" | "Cancelled";
export type FrontDeskStayMode = "Hourly" | "Daily";
export type FolioTaxModeType = "Exempt" | "VatIncluded" | "VatExcluded";
export type FolioPaymentMethodType = "Cash" | "BankTransfer" | "PromptPay";
export type RegulatoryReportType = "RR4" | "TM30";
