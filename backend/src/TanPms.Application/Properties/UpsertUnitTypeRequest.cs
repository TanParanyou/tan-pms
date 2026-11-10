using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Properties;

public sealed record UpsertUnitTypeRequest(
    Guid? Id,
    string Code,
    LocalizedTextDto Name,
    LocalizedTextDto? Description,
    decimal AreaSqm,
    int TotalQuotaUnits,
    IReadOnlyList<string> SupportedStayModes,
    decimal HourlyBasePackagePrice,
    int HourlyBasePackageHours,
    decimal HourlyAdditionalHourPrice,
    decimal DailyRate,
    decimal MonthlyRentRate);
