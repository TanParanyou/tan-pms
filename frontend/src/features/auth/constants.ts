import { CENTRAL_PROPERTIES } from "@/constants/master-data";

export const DEMO_AUTH_CREDENTIALS = {
  adminUsername: "staff.reception@tan-pms",
  clientNationalId: "1-1002-39481-22-1",
  maskedPassword: "••••••••••••",
} as const;

export const AUTHORIZED_PROPERTY_CODES = CENTRAL_PROPERTIES.map((p) => p.code);
