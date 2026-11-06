namespace TanPms.Domain.Rates;

public sealed record UtilityMeterCalculationResult(
    decimal PreviousReading,
    decimal CurrentReading,
    decimal UsageUnits,
    decimal ChargeAmount,
    bool UsedRollover);
