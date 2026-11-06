namespace TanPms.Domain.Rates;

public sealed record UtilityTariff(
    UtilityBillingMode BillingMode,
    decimal RatePerUnit,
    decimal MinimumChargeAmount = 0m,
    decimal IncludedUnits = 0m,
    decimal BaseMinimumAmount = 0m,
    decimal FlatRateAmount = 0m,
    bool FlatRatePerOccupant = false);
