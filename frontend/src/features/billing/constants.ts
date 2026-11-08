import type { BadgeProps } from "@/components/ui/badge";
import type { InvoiceStatusType, TaxModeType } from "./types";

export const INVOICE_STATUS_OPTIONS: readonly InvoiceStatusType[] = [
  "Draft",
  "Issued",
  "PartiallyPaid",
  "Paid",
  "Overdue",
  "Voided",
];

export const INVOICE_STATUS_BADGE_VARIANT: Record<InvoiceStatusType, NonNullable<BadgeProps["variant"]>> = {
  Draft: "secondary",
  Issued: "default",
  PartiallyPaid: "warning",
  Paid: "success",
  Overdue: "destructive",
  Voided: "outline",
};

/** Backend skip code -> i18n key under admin.billing.skipReasons. */
export const BILLING_SKIP_REASON_KEYS: Record<string, string> = {
  "billing.invoice_exists": "invoiceExists",
  "billing.missing_meter_readings": "missingMeterReadings",
};
export const BILLING_SKIP_UNKNOWN_KEY = "unknown";

export const PERMISSION_BILLING_ISSUE_BATCH = "admin.billing.issue_batch";

export const PERMISSION_INVOICES_VOID = "admin.invoices.void";

export const TAX_MODE_OPTIONS: readonly TaxModeType[] = ["Exempt", "VatIncluded", "VatExcluded"];

/** Statuses a posted invoice can be voided from (Draft is deleted, Paid/Voided are final). */
export const INVOICE_VOIDABLE_STATUSES: readonly InvoiceStatusType[] = ["Issued", "PartiallyPaid", "Overdue"];

export const INVOICE_LINE_DEFAULTS = {
  descriptionTh: "",
  descriptionEn: "",
  lineAmount: 0,
  taxMode: "VatIncluded" as TaxModeType,
};
