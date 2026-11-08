import type { components } from "@/generated/api/tan-pms.v1";

type Schemas = components["schemas"];

export type MeterReadingSheetResponse = Schemas["MeterReadingSheetResponse"];
export type MeterReadingSheetRowDto = Schemas["MeterReadingSheetRowDto"];
export type UtilityReadingDto = Schemas["UtilityReadingDto"];
export type SaveMeterReadingsRequest = Schemas["SaveMeterReadingsRequest"];
export type SaveMeterReadingsResponse = Schemas["SaveMeterReadingsResponse"];
export type MeterReadingRowResultDto = Schemas["MeterReadingRowResultDto"];
export type MeterReadingInputDto = Schemas["MeterReadingInputDto"];
export type BatchInvoiceRunRequest = Schemas["BatchInvoiceRunRequest"];
export type BatchInvoiceRunResponse = Schemas["BatchInvoiceRunResponse"];
export type IssueInvoicesRequest = Schemas["IssueInvoicesRequest"];
export type InvoiceListResponse = Schemas["InvoiceListResponse"];
export type InvoiceIssueResponse = Schemas["InvoiceIssueResponse"];
export type InvoiceItemDto = Schemas["InvoiceItemDto"];
export type InvoiceStatusType =
  | "Draft"
  | "Issued"
  | "PartiallyPaid"
  | "Paid"
  | "Overdue"
  | "Voided";
export type InvoiceLineRequest = Schemas["InvoiceLineRequest"];
export type InvoiceLineDto = Schemas["InvoiceLineDto"];
export type BatchInvoiceSkipDto = Schemas["BatchInvoiceSkipDto"];
export type TaxModeType = "Exempt" | "VatIncluded" | "VatExcluded";
