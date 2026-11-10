using TanPms.Application.Common.Results;
using TanPms.Domain.Common;
using TanPms.Domain.Properties;

namespace TanPms.Application.Properties;

// Shared master-data validation and "in use" errors for both persistence providers.
public static class PropertyCatalogRules
{
    public static Error? ValidateBuilding(UpsertBuildingRequest request) =>
        string.IsNullOrWhiteSpace(request.Code) || request.Code.Trim().Length > 32
            ? Invalid("Building Code is required (max 32 characters).")
            : null;

    public static Error? ValidateFloor(UpsertFloorRequest request) =>
        request.BuildingId == Guid.Empty || request.FloorNumber is < -10 or > 200
            ? Invalid("BuildingId is required and FloorNumber must be between -10 and 200.")
            : null;

    public static Error? ValidateUnitType(UpsertUnitTypeRequest request, out List<StayMode> stayModes)
    {
        stayModes = [];
        if (string.IsNullOrWhiteSpace(request.Code) || request.Code.Trim().Length > 32)
        {
            return Invalid("UnitType Code is required (max 32 characters).");
        }

        if (request.AreaSqm < 0m || request.TotalQuotaUnits < 0 || request.HourlyBasePackagePrice < 0m
            || request.HourlyBasePackageHours < 1 || request.HourlyAdditionalHourPrice < 0m || request.DailyRate < 0m || request.MonthlyRentRate < 0m)
        {
            return Invalid("UnitType prices, area and quota cannot be negative and HourlyBasePackageHours must be at least 1.");
        }

        foreach (var mode in request.SupportedStayModes ?? [])
        {
            if (int.TryParse(mode, out _) || !Enum.TryParse<StayMode>(mode, ignoreCase: true, out var parsed) || !Enum.IsDefined(parsed))
            {
                return Invalid($"Invalid StayMode '{mode}'.");
            }

            stayModes.Add(parsed);
        }

        return stayModes.Count == 0 ? Invalid("At least one SupportedStayMode is required.") : null;
    }

    public static Error InUse(string entity, string label, string usage) =>
        new(DomainErrorCodes.MasterDataInUse, $"{entity} {label} cannot be deleted because it has {usage}.");

    public static Error DuplicateCode(string entity, string code) =>
        Invalid($"{entity} code '{code}' already exists in this property.");

    public static Error NotFound(string entity, Guid propertyId, Guid id) =>
        Invalid($"{entity} '{id}' was not found in property '{propertyId}'.");

    private static Error Invalid(string message) => new(DomainErrorCodes.ValidationFailed, message);
}
