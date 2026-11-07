namespace TanPms.Application.Meters;

public sealed record UtilityReadingResultDto(
    decimal PreviousReading,
    decimal CurrentReading,
    decimal UsageUnits,
    decimal ChargeAmount,
    bool UsedRollover);
