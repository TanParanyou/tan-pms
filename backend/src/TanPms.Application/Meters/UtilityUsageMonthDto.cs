namespace TanPms.Application.Meters;

public sealed record UtilityUsageMonthDto(
    string Period,
    decimal? WaterUsageUnits,
    decimal? WaterChargeAmount,
    decimal? ElectricUsageUnits,
    decimal? ElectricChargeAmount);
