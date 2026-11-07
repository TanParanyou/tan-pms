import type { components } from "@/generated/api/tan-pms.v1";

type Schemas = components["schemas"];

export type AdminPaymentSlipDto = Schemas["AdminPaymentSlipDto"];
export type PaymentSlipQueueResponse = Schemas["PaymentSlipQueueResponse"];
export type RejectPaymentSlipRequest = Schemas["RejectPaymentSlipRequest"];
export type PaymentSlipStatusType = "Pending" | "Approved" | "Rejected";
