import type { components } from "@/generated/api/tan-pms.v1";

type Schemas = components["schemas"];

export type StoredFileDto = Schemas["StoredFileDto"];
export type ReceiptListResponse = Schemas["ReceiptListResponse"];
export type ReceiptItemDto = Schemas["ReceiptItemDto"];
export type StoredFilePurpose =
  | "MeterPhoto"
  | "PaymentSlip"
  | "WorkOrderPhoto"
  | "ParcelPhoto"
  | "LeaseInspectionPhoto"
  | "IdentityDocument";
