import type { components } from "@/generated/api/tan-pms.v1";

type Schemas = components["schemas"];

export type DepositLedgerItemDto = Schemas["DepositLedgerItemDto"];
export type DepositLedgerListResponse = Schemas["DepositLedgerListResponse"];
export type DepositTransactionDto = Schemas["DepositTransactionDto"];
export type DepositTypeValue = "KeyDeposit" | "ReservationDeposit" | "LeaseSecurityDeposit";
