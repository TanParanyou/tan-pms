namespace TanPms.Application.Rates;

public sealed record UtilitySimulationQuoteDto(
    string UtilityType,
    decimal UsageUnits,
    decimal ChargeAmount,
    bool UsedRollover);
