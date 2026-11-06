using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Rates;

public sealed record UpsertRatePlanRequest(
    Guid? Id,
    string Code,
    LocalizedTextDto Name,
    Guid UnitTypeId,
    IReadOnlyList<string> SupportedStayModes,
    HourlyPackageConfigDto HourlyPackage,
    DailyRateConfigDto DailyRate,
    MonthlyRateConfigDto MonthlyRate,
    bool IsActive);
