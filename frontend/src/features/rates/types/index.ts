import type {
  HourlyPackageConfigDto,
  DailyRateConfigDto,
  MonthlyRateConfigDto,
  RatePlanItemDto,
  UpsertRatePlanRequest,
  UtilityTariffItemDto,
  UpsertUtilityTariffRequest,
  TaxProfileItemDto,
  UpsertTaxProfileRequest,
  PropertyRateCatalogResponse,
  RateSimulationRequest,
  HourlySimulationQuoteDto,
  UtilitySimulationQuoteDto,
  TaxSimulationQuoteDto,
  RateSimulationResponse,
  UnitTypeRefDto,
  LocalizedTextDto,
} from "@/generated/api";

export type {
  HourlyPackageConfigDto,
  DailyRateConfigDto,
  MonthlyRateConfigDto,
  RatePlanItemDto,
  UpsertRatePlanRequest,
  UtilityTariffItemDto,
  UpsertUtilityTariffRequest,
  TaxProfileItemDto,
  UpsertTaxProfileRequest,
  PropertyRateCatalogResponse,
  RateSimulationRequest,
  HourlySimulationQuoteDto,
  UtilitySimulationQuoteDto,
  TaxSimulationQuoteDto,
  RateSimulationResponse,
  UnitTypeRefDto,
  LocalizedTextDto,
};

export type RateCatalogTabKey =
  | "rate-plans"
  | "utility-tariffs"
  | "tax-profiles";

export type StayModeType = "Hourly" | "Daily" | "Monthly";

export type UtilityBillingModeType = "PerUnit" | "MinimumUnits" | "FlatRate";

export type ThaiTaxModeType = "Exempt" | "VatIncluded" | "VatExcluded";
