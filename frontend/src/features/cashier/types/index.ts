import type { components } from "@/generated/api/tan-pms.v1";

type Schemas = components["schemas"];

export type CashierShiftDto = Schemas["CashierShiftDto"];
export type CashierShiftListResponse = Schemas["CashierShiftListResponse"];
export type CurrentCashierShiftResponse = Schemas["CurrentCashierShiftResponse"];
export type OpenCashierShiftRequest = Schemas["OpenCashierShiftRequest"];
export type CloseCashierShiftRequest = Schemas["CloseCashierShiftRequest"];
export type ReconcileCashierShiftRequest = Schemas["ReconcileCashierShiftRequest"];
export type CashierShiftStatusType = "Open" | "Closed" | "Reconciled";
