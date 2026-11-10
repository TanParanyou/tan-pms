/** Backend template key -> i18n key under client.notifications.templates (titles); unknown keys fall back to the backend title. */
export const NOTIFICATION_TEMPLATE_I18N_KEYS: Record<string, string> = {
  "invoice.issued": "invoiceIssued",
  "invoice.overdue": "invoiceOverdue",
  "parcel.arrived": "parcelArrived",
  "lease.intent_approved": "leaseIntentApproved",
  "lease.intent_rejected": "leaseIntentRejected",
};
