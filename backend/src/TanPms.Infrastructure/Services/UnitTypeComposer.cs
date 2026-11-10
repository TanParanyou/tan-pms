using TanPms.Application.Properties;
using TanPms.Domain.Common;
using TanPms.Domain.Properties;

namespace TanPms.Infrastructure.Services;

// Shared by both stores so a unit type upsert maps request fields identically.
internal static class UnitTypeComposer
{
    internal static void Apply(UnitType unitType, string code, UpsertUnitTypeRequest request, IReadOnlyList<StayMode> stayModes)
    {
        unitType.Code = code;
        unitType.Name = LocalizedText.Create(request.Name.Th, request.Name.En);
        unitType.Description = request.Description is null ? null : LocalizedText.CreateOptional(request.Description.Th, request.Description.En);
        unitType.AreaSqm = request.AreaSqm;
        unitType.TotalQuotaUnits = request.TotalQuotaUnits;
        unitType.SupportedStayModes.Clear();
        unitType.SupportedStayModes.AddRange(stayModes.Distinct());
        unitType.HourlyBasePackagePrice = request.HourlyBasePackagePrice;
        unitType.HourlyBasePackageHours = request.HourlyBasePackageHours;
        unitType.HourlyAdditionalHourPrice = request.HourlyAdditionalHourPrice;
        unitType.DailyRate = request.DailyRate;
        unitType.MonthlyRentRate = request.MonthlyRentRate;
    }
}
