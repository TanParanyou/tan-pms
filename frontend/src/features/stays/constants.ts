import type { BadgeProps } from "@/components/ui/badge";

export const PERMISSION_STAY_CHECKIN = "admin.stay.checkin";
export const PERMISSION_STAY_CHECKOUT = "admin.stay.checkout";
export const PERMISSION_REGULATORY_EXPORT = "admin.regulatory.export";
export const PERMISSION_UNMASK_PII = "admin.customer.unmask_pii";
export const PERMISSION_INVOICES_VOID = "admin.invoices.void";

export const STAY_STATUS_OPTIONS = ["Active", "CheckedOut", "Cancelled"] as const;
export const STAY_STATUS_BADGE_VARIANT: Record<string, NonNullable<BadgeProps["variant"]>> = {
  Active: "success",
  CheckedOut: "outline",
  Cancelled: "destructive",
};
export const FOLIO_TAX_MODES = ["Exempt", "VatIncluded", "VatExcluded"] as const;
export const FOLIO_PAYMENT_METHODS = ["Cash", "BankTransfer", "PromptPay"] as const;
export const EXTEND_HOUR_OPTIONS = [1, 2, 3] as const;

export const STAY_CREATE_DEFAULTS = {
  unitId: "",
  customerId: "",
  stayMode: "Hourly" as "Hourly" | "Daily",
  durationHours: 3,
  durationDays: 1,
  dirtyOverrideReason: "",
  primaryGuestName: "",
  primaryNationality: "",
  primaryIdNumber: "",
  primaryPhoneNumber: "",
  primaryLicensePlate: "",
  keyDepositAmount: 500,
};
export const CHECK_IN_STAY_MODES = ["Hourly", "Daily"] as const;
export const MS_PER_HOUR = 60 * 60 * 1000;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

export const OCCUPANT_FORM_DEFAULTS = {
  fullName: "",
  nationalityCode: "",
  identityNumber: "",
  isPrimaryOccupant: false,
  vehicleLicensePlate: "",
  phoneNumber: "",
};
export const CHARGE_FORM_DEFAULTS = { descriptionTh: "", descriptionEn: "", amount: 0, taxMode: "VatIncluded" as (typeof FOLIO_TAX_MODES)[number] };
export const PAYMENT_FORM_DEFAULTS = { amount: 0, paymentMethod: "Cash" as (typeof FOLIO_PAYMENT_METHODS)[number] };
export const ALL_FILTER = "";
