using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Properties;

public sealed record UnitTypeDetailDto(
    Guid Id,
    string Code,
    LocalizedTextDto Name,
    LocalizedTextDto? Description,
    decimal AreaSqm,
    int TotalQuotaUnits,
    IReadOnlyList<string> SupportedStayModes,
    decimal HourlyBasePackagePrice,
    decimal DailyRate,
    decimal MonthlyRentRate,
    int HourlyBasePackageHours,
    decimal HourlyAdditionalHourPrice);
