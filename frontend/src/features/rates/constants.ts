export const PERMISSION_RATES_MANAGE = "admin.rates.manage";

export const RATE_STAY_MODES = ["Hourly", "Daily", "Monthly"] as const;
export const UTILITY_TYPES = ["Water", "Electric"] as const;
export const BILLING_MODES = ["PerUnit", "MinimumUnits", "FlatRate"] as const;
export const TAX_MODES = ["Exempt", "VatIncluded", "VatExcluded"] as const;

export const RATE_PLAN_FORM_DEFAULTS = {
  code: "",
  nameTh: "",
  nameEn: "",
  unitTypeId: "",
  supportedStayModes: ["Hourly", "Daily", "Monthly"] as (typeof RATE_STAY_MODES)[number][],
  isActive: true,
  basePackageHours: 3,
  basePackagePrice: 0,
  additionalHourPrice: 0,
  gracePeriodMinutes: 15,
  autoCapToDailyRate: 0,
  turnaroundBufferMinutes: 30,
  weekdayRate: 0,
  weekendRate: 0,
  holidaySurchargeAmount: 0,
  extraGuestPrice: 0,
  monthlyRentRate: 0,
  minimumLeaseMonths: 1,
  securityDepositMonths: 2,
};

export const TARIFF_FORM_DEFAULTS = {
  utilityType: "Water" as (typeof UTILITY_TYPES)[number],
  nameTh: "",
  nameEn: "",
  billingMode: "PerUnit" as (typeof BILLING_MODES)[number],
  ratePerUnit: 0,
  minimumChargeAmount: 0,
  includedUnits: 0,
  baseMinimumAmount: 0,
  flatRateAmount: 0,
  flatRatePerOccupant: false,
  meterMaxDigits: 5,
};

export const TAX_FORM_DEFAULTS = {
  chargeCategoryCode: "",
  nameTh: "",
  nameEn: "",
  taxMode: "VatIncluded" as (typeof TAX_MODES)[number],
  vatRatePercent: 7,
  defaultWithholdingTaxPercent: 0,
  isActive: true,
};
