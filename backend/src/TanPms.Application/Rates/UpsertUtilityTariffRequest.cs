using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Rates;

public sealed record UpsertUtilityTariffRequest(
    string UtilityType,
    LocalizedTextDto Name,
    string BillingMode,
    decimal RatePerUnit,
    decimal MinimumChargeAmount,
    decimal IncludedUnits,
    decimal BaseMinimumAmount,
    decimal FlatRateAmount,
    bool FlatRatePerOccupant,
    int MeterMaxDigits);
