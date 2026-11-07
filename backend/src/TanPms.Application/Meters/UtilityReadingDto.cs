namespace TanPms.Application.Meters;

public sealed record UtilityReadingDto(
    int? MeterMaxDigits,
    decimal PreviousReading,
    decimal? PreviousUsageUnits,
    decimal? CurrentReading,
    decimal? UsageUnits,
    decimal? ChargeAmount,
    bool IsRolloverConfirmed,
    string? PhotoFileKey);
