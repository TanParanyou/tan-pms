import type { ProblemDetailsResponse } from "@/generated/api";
import thMessages from "@/messages/th.json";
import enMessages from "@/messages/en.json";

export type { ProblemDetailsResponse };

export const ERROR_CODE_I18N_KEYS: Record<string, string> = {
  "validation.failed": "errors.validation_failed",
  "auth.unauthenticated": "errors.auth_unauthenticated",
  "auth.property_scope_denied": "errors.auth_property_scope_denied",
  "auth.permission_denied": "errors.auth_permission_denied",
  "unit.not_clean": "errors.unit_not_clean",
  "reservation.slot_overlap": "errors.reservation_slot_overlap",
  "reservation.quota_exhausted": "errors.reservation_quota_exhausted",
  "reservation.hold_expired": "errors.reservation_hold_expired",
  "stay.folio_unsettled": "errors.stay_folio_unsettled",
  "invoice.immutable_status": "errors.invoice_immutable_status",
  "shift.not_open": "errors.shift_not_open",
  "meter.rollover_unconfirmed": "errors.meter_rollover_unconfirmed",
};

export function isProblemDetails(data: unknown): data is ProblemDetailsResponse {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.errorCode === "string" || typeof obj.title === "string";
}

export function parseProblemDetails(response: unknown): ProblemDetailsResponse | null {
  if (isProblemDetails(response)) {
    return response;
  }
  return null;
}

export function getErrorCodeKey(errorCode: string | undefined): string {
  if (!errorCode) return "errors.generic";
  return ERROR_CODE_I18N_KEYS[errorCode] || "errors.generic";
}

export function getLocalizedErrorMessage(
  problem: ProblemDetailsResponse | string,
  locale: "th" | "en" = "th"
): string {
  const code = typeof problem === "string" ? problem : problem.errorCode;
  const messages = locale === "en" ? enMessages : thMessages;
  const keyMap: Record<string, keyof typeof messages.errors> = {
    "validation.failed": "validation_failed",
    "auth.unauthenticated": "auth_unauthenticated",
    "auth.property_scope_denied": "auth_property_scope_denied",
    "auth.permission_denied": "auth_permission_denied",
    "unit.not_clean": "unit_not_clean",
    "reservation.slot_overlap": "reservation_slot_overlap",
    "reservation.quota_exhausted": "reservation_quota_exhausted",
    "reservation.hold_expired": "reservation_hold_expired",
    "stay.folio_unsettled": "stay_folio_unsettled",
    "invoice.immutable_status": "invoice_immutable_status",
    "shift.not_open": "shift_not_open",
    "meter.rollover_unconfirmed": "meter_rollover_unconfirmed",
  };

  const errorKey = code ? keyMap[code] : undefined;
  if (errorKey && messages.errors[errorKey]) {
    return messages.errors[errorKey];
  }

  if (typeof problem !== "string" && problem.detail) {
    return problem.detail;
  }

  return messages.errors.generic;
}
