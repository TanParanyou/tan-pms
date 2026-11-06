using TanPms.Application.Common.Contracts;
using TanPms.Application.Properties;

namespace TanPms.Application.Rates;

public sealed record RatePlanItemDto(
    Guid Id,
    string Code,
    LocalizedTextDto Name,
    UnitTypeRefDto UnitType,
    IReadOnlyList<string> SupportedStayModes,
    HourlyPackageConfigDto HourlyPackage,
    DailyRateConfigDto DailyRate,
    MonthlyRateConfigDto MonthlyRate,
    bool IsActive);
