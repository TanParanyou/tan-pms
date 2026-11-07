export const METER_UTILITIES = ["water", "electric"] as const;
export type MeterUtility = (typeof METER_UTILITIES)[number];

/** Backend issue code -> i18n key under admin.meters.issues (codes contain dots, so they cannot be used as keys). */
export const METER_ISSUE_MESSAGE_KEYS: Record<string, string> = {
  "meter.rollover_unconfirmed": "rolloverUnconfirmed",
  "meter.negative_reading": "negativeReading",
  "meter.no_active_lease": "noActiveLease",
  "meter.duplicate_unit": "duplicateUnit",
  "meter.tariff_missing": "tariffMissing",
  "meter.period_locked": "periodLocked",
  "meter.override_reason_required": "overrideReasonRequired",
  "meter.usage_anomaly": "usageAnomaly",
};

export const METER_ISSUE_UNKNOWN_KEY = "unknownIssue";

export const PERMISSION_METERS_RECORD = "admin.meters.record";
export const PERMISSION_METERS_OVERRIDE_LOCKED = "admin.meters.override_locked";
