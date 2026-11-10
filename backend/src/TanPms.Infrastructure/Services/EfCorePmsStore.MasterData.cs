using Microsoft.EntityFrameworkCore;
using TanPms.Application.Common.Results;
using TanPms.Application.Identity;
using TanPms.Application.Properties;
using TanPms.Application.Rates;
using TanPms.Domain.Common;
using TanPms.Domain.Leases;
using TanPms.Domain.Properties;
using TanPms.Domain.Reservations;
using TanPms.Domain.Stays;

namespace TanPms.Infrastructure.Services;

// PM-01..PM-03 single reads, edits and guarded deletes. Projections reuse the hierarchy/catalog mappers so every
// endpoint returns the same DTO shape as the list views.
public sealed partial class EfCorePmsStore
{
    public Result<AdminUserDto> GetAdminUser(Guid userId)
    {
        var user = _dbContext.AdminUsers.AsNoTracking().FirstOrDefault(u => u.Id == userId);
        return user is null
            ? Result<AdminUserDto>.Failure(IdentityRules.NotFound(userId))
            : Result<AdminUserDto>.Success(MapAdminUserDto(user, _dbContext.Properties.AsNoTracking().ToDictionary(p => p.Id)));
    }

    public Result<AdminUserDto> SetAdminUserActive(Guid userId, bool isActive)
    {
        var user = _dbContext.AdminUsers.FirstOrDefault(u => u.Id == userId);
        if (user is null)
        {
            return Result<AdminUserDto>.Failure(IdentityRules.NotFound(userId));
        }

        if (IdentityRules.CheckKeepsAnOrganizationAdmin(user, isActive, user.RoleCode, _dbContext.AdminUsers.AsNoTracking().ToList()) is { } adminError)
        {
            return Result<AdminUserDto>.Failure(adminError);
        }

        user.IsActive = isActive;
        _dbContext.SaveChanges();
        return Result<AdminUserDto>.Success(MapAdminUserDto(user, _dbContext.Properties.AsNoTracking().ToDictionary(p => p.Id)));
    }

    public Result<UnitMasterItemDto> GetUnitMaster(Guid propertyId, Guid unitId) =>
        PickFromHierarchy(propertyId, h => h.Units.FirstOrDefault(u => u.Id == unitId), PropertyCatalogRules.NotFound("Unit", propertyId, unitId));

    public Result<BuildingDetailDto> UpsertBuilding(Guid propertyId, UpsertBuildingRequest request)
    {
        if (PropertyCatalogRules.ValidateBuilding(request) is { } validationError)
        {
            return Result<BuildingDetailDto>.Failure(validationError);
        }

        var code = request.Code.Trim().ToUpperInvariant();
        if (_dbContext.Buildings.AsNoTracking().Any(b => b.PropertyId == propertyId && b.Code == code && b.Id != request.Id))
        {
            return Result<BuildingDetailDto>.Failure(PropertyCatalogRules.DuplicateCode("Building", code));
        }

        try
        {
            var name = LocalizedText.Create(request.Name.Th, request.Name.En);
            var building = request.Id.HasValue
                ? _dbContext.Buildings.FirstOrDefault(b => b.Id == request.Id.Value && b.PropertyId == propertyId)
                : null;
            if (request.Id.HasValue && building is null)
            {
                return Result<BuildingDetailDto>.Failure(PropertyCatalogRules.NotFound("Building", propertyId, request.Id.Value));
            }

            if (building is null)
            {
                building = new Building { PropertyId = propertyId, Code = code, Name = name };
                _dbContext.Buildings.Add(building);
            }

            building.Code = code;
            building.Name = name;
            _dbContext.SaveChanges();
            var id = building.Id;
            return PickFromHierarchy(propertyId, h => h.Buildings.FirstOrDefault(b => b.Id == id), PropertyCatalogRules.NotFound("Building", propertyId, id));
        }
        catch (DomainRuleException ex)
        {
            return Result<BuildingDetailDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
    }

    public Result<FloorDetailDto> UpsertFloor(Guid propertyId, UpsertFloorRequest request)
    {
        if (PropertyCatalogRules.ValidateFloor(request) is { } validationError)
        {
            return Result<FloorDetailDto>.Failure(validationError);
        }

        if (!_dbContext.Buildings.AsNoTracking().Any(b => b.Id == request.BuildingId && b.PropertyId == propertyId))
        {
            return Result<FloorDetailDto>.Failure(PropertyCatalogRules.NotFound("Building", propertyId, request.BuildingId));
        }

        if (_dbContext.Floors.AsNoTracking().Any(f => f.BuildingId == request.BuildingId && f.FloorNumber == request.FloorNumber && f.Id != request.Id))
        {
            return Result<FloorDetailDto>.Failure(PropertyCatalogRules.DuplicateCode("Floor", request.FloorNumber.ToString(System.Globalization.CultureInfo.InvariantCulture)));
        }

        try
        {
            var name = LocalizedText.Create(request.Name.Th, request.Name.En);
            var floor = request.Id.HasValue ? _dbContext.Floors.FirstOrDefault(f => f.Id == request.Id.Value && f.PropertyId == propertyId) : null;
            if (request.Id.HasValue && floor is null)
            {
                return Result<FloorDetailDto>.Failure(PropertyCatalogRules.NotFound("Floor", propertyId, request.Id.Value));
            }

            if (floor is null)
            {
                floor = new Floor { PropertyId = propertyId, BuildingId = request.BuildingId, FloorNumber = request.FloorNumber, Name = name };
                _dbContext.Floors.Add(floor);
            }
            else if (floor.BuildingId != request.BuildingId && _dbContext.Units.AsNoTracking().Any(u => u.FloorId == floor.Id))
            {
                return Result<FloorDetailDto>.Failure(PropertyCatalogRules.InUse("Floor", floor.FloorNumber.ToString(System.Globalization.CultureInfo.InvariantCulture), "units and cannot move to another building"));
            }

            floor.BuildingId = request.BuildingId;
            floor.FloorNumber = request.FloorNumber;
            floor.Name = name;
            _dbContext.SaveChanges();
            var id = floor.Id;
            return PickFromHierarchy(propertyId, h => h.Buildings.SelectMany(b => b.Floors).FirstOrDefault(f => f.Id == id), PropertyCatalogRules.NotFound("Floor", propertyId, id));
        }
        catch (DomainRuleException ex)
        {
            return Result<FloorDetailDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
    }

    public Result<UnitTypeDetailDto> UpsertUnitType(Guid propertyId, UpsertUnitTypeRequest request)
    {
        if (PropertyCatalogRules.ValidateUnitType(request, out var stayModes) is { } validationError)
        {
            return Result<UnitTypeDetailDto>.Failure(validationError);
        }

        var code = request.Code.Trim().ToUpperInvariant();
        if (_dbContext.UnitTypes.AsNoTracking().Any(t => t.PropertyId == propertyId && t.Code == code && t.Id != request.Id))
        {
            return Result<UnitTypeDetailDto>.Failure(PropertyCatalogRules.DuplicateCode("UnitType", code));
        }

        try
        {
            var unitType = request.Id.HasValue ? _dbContext.UnitTypes.FirstOrDefault(t => t.Id == request.Id.Value && t.PropertyId == propertyId) : null;
            if (request.Id.HasValue && unitType is null)
            {
                return Result<UnitTypeDetailDto>.Failure(PropertyCatalogRules.NotFound("UnitType", propertyId, request.Id.Value));
            }

            if (unitType is null)
            {
                unitType = new UnitType { PropertyId = propertyId, Code = code, Name = LocalizedText.Create(request.Name.Th, request.Name.En) };
                _dbContext.UnitTypes.Add(unitType);
            }

            UnitTypeComposer.Apply(unitType, code, request, stayModes);
            _dbContext.SaveChanges();
            var id = unitType.Id;
            return PickFromHierarchy(propertyId, h => h.UnitTypes.FirstOrDefault(t => t.Id == id), PropertyCatalogRules.NotFound("UnitType", propertyId, id));
        }
        catch (DomainRuleException ex)
        {
            return Result<UnitTypeDetailDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
    }

    public Result<UnitMasterItemDto> DeleteUnitMaster(Guid propertyId, Guid unitId)
    {
        var unit = _dbContext.Units.FirstOrDefault(u => u.Id == unitId && u.PropertyId == propertyId);
        if (unit is null)
        {
            return Result<UnitMasterItemDto>.Failure(PropertyCatalogRules.NotFound("Unit", propertyId, unitId));
        }

        // Any operational history keeps the unit; documents must keep resolving their unit.
        var usage = new List<string>();
        if (_dbContext.Leases.IgnoreQueryFilters().Any(l => l.UnitId == unitId)) usage.Add("leases");
        if (_dbContext.Stays.IgnoreQueryFilters().Any(s => s.UnitId == unitId)) usage.Add("stays");
        if (_dbContext.Reservations.IgnoreQueryFilters().Any(r => r.UnitId == unitId)) usage.Add("reservations");
        if (_dbContext.HousekeepingTasks.IgnoreQueryFilters().Any(t => t.UnitId == unitId)) usage.Add("housekeeping history");
        if (_dbContext.MeterReadings.IgnoreQueryFilters().Any(r => r.UnitId == unitId)) usage.Add("meter readings");
        if (_dbContext.WorkOrders.IgnoreQueryFilters().Any(w => w.UnitId == unitId)) usage.Add("work orders");
        if (_dbContext.Parcels.IgnoreQueryFilters().Any(p => p.UnitId == unitId)) usage.Add("parcels");
        if (usage.Count > 0)
        {
            return Result<UnitMasterItemDto>.Failure(PropertyCatalogRules.InUse("Unit", unit.UnitNumber, string.Join(", ", usage)));
        }

        var dto = GetUnitMaster(propertyId, unitId).Value!;
        _dbContext.Units.Remove(unit);
        _dbContext.SaveChanges();
        return Result<UnitMasterItemDto>.Success(dto);
    }

    public Result<BuildingDetailDto> DeleteBuilding(Guid propertyId, Guid buildingId)
    {
        var building = _dbContext.Buildings.FirstOrDefault(b => b.Id == buildingId && b.PropertyId == propertyId);
        if (building is null)
        {
            return Result<BuildingDetailDto>.Failure(PropertyCatalogRules.NotFound("Building", propertyId, buildingId));
        }

        if (_dbContext.Floors.Any(f => f.BuildingId == buildingId) || _dbContext.Units.Any(u => u.BuildingId == buildingId))
        {
            return Result<BuildingDetailDto>.Failure(PropertyCatalogRules.InUse("Building", building.Code, "floors or units"));
        }

        var dto = PickFromHierarchy(propertyId, h => h.Buildings.FirstOrDefault(b => b.Id == buildingId), PropertyCatalogRules.NotFound("Building", propertyId, buildingId)).Value!;
        _dbContext.Buildings.Remove(building);
        _dbContext.SaveChanges();
        return Result<BuildingDetailDto>.Success(dto);
    }

    public Result<FloorDetailDto> DeleteFloor(Guid propertyId, Guid floorId)
    {
        var floor = _dbContext.Floors.FirstOrDefault(f => f.Id == floorId && f.PropertyId == propertyId);
        if (floor is null)
        {
            return Result<FloorDetailDto>.Failure(PropertyCatalogRules.NotFound("Floor", propertyId, floorId));
        }

        if (_dbContext.Units.Any(u => u.FloorId == floorId))
        {
            return Result<FloorDetailDto>.Failure(PropertyCatalogRules.InUse("Floor", floor.FloorNumber.ToString(System.Globalization.CultureInfo.InvariantCulture), "units"));
        }

        var dto = PickFromHierarchy(propertyId, h => h.Buildings.SelectMany(b => b.Floors).FirstOrDefault(f => f.Id == floorId), PropertyCatalogRules.NotFound("Floor", propertyId, floorId)).Value!;
        _dbContext.Floors.Remove(floor);
        _dbContext.SaveChanges();
        return Result<FloorDetailDto>.Success(dto);
    }

    public Result<UnitTypeDetailDto> DeleteUnitType(Guid propertyId, Guid unitTypeId)
    {
        var unitType = _dbContext.UnitTypes.FirstOrDefault(t => t.Id == unitTypeId && t.PropertyId == propertyId);
        if (unitType is null)
        {
            return Result<UnitTypeDetailDto>.Failure(PropertyCatalogRules.NotFound("UnitType", propertyId, unitTypeId));
        }

        if (_dbContext.Units.Any(u => u.UnitTypeId == unitTypeId)
            || _dbContext.RatePlans.Any(p => p.UnitTypeId == unitTypeId)
            || _dbContext.Reservations.IgnoreQueryFilters().Any(r => r.UnitTypeId == unitTypeId))
        {
            return Result<UnitTypeDetailDto>.Failure(PropertyCatalogRules.InUse("UnitType", unitType.Code, "units, rate plans or reservations"));
        }

        var dto = PickFromHierarchy(propertyId, h => h.UnitTypes.FirstOrDefault(t => t.Id == unitTypeId), PropertyCatalogRules.NotFound("UnitType", propertyId, unitTypeId)).Value!;
        _dbContext.UnitTypes.Remove(unitType);
        _dbContext.SaveChanges();
        return Result<UnitTypeDetailDto>.Success(dto);
    }

    public Result<RatePlanItemDto> GetRatePlan(Guid propertyId, Guid ratePlanId) =>
        PickFromCatalog(propertyId, c => c.RatePlans.FirstOrDefault(p => p.Id == ratePlanId), RateCatalogRules.NotFound("RatePlan", propertyId, ratePlanId));

    public Result<UtilityTariffItemDto> GetUtilityTariff(Guid propertyId, Guid tariffId) =>
        PickFromCatalog(propertyId, c => c.UtilityTariffs.FirstOrDefault(t => t.Id == tariffId), RateCatalogRules.NotFound("UtilityTariff", propertyId, tariffId));

    public Result<TaxProfileItemDto> GetTaxProfile(Guid propertyId, Guid taxProfileId) =>
        PickFromCatalog(propertyId, c => c.TaxProfiles.FirstOrDefault(t => t.Id == taxProfileId), RateCatalogRules.NotFound("TaxProfile", propertyId, taxProfileId));

    public Result<RatePlanItemDto> DeleteRatePlan(Guid propertyId, Guid ratePlanId)
    {
        var plan = _dbContext.RatePlans.FirstOrDefault(p => p.Id == ratePlanId && p.PropertyId == propertyId);
        if (plan is null)
        {
            return Result<RatePlanItemDto>.Failure(RateCatalogRules.NotFound("RatePlan", propertyId, ratePlanId));
        }

        // Pricing of live bookings falls back to the active plan of the unit type, so keep at least one while any are live.
        var otherActivePlan = _dbContext.RatePlans.Any(p => p.UnitTypeId == plan.UnitTypeId && p.Id != plan.Id && p.IsActive);
        var unitIds = _dbContext.Units.Where(u => u.UnitTypeId == plan.UnitTypeId).Select(u => u.Id).ToList();
        var liveUsage = _dbContext.Reservations.Any(r => r.UnitTypeId == plan.UnitTypeId
                && (r.Status == ReservationStatus.Hold || r.Status == ReservationStatus.PendingVerification || r.Status == ReservationStatus.Confirmed))
            || _dbContext.Stays.Any(s => unitIds.Contains(s.UnitId) && s.Status == StayStatus.Active)
            || _dbContext.Leases.Any(l => unitIds.Contains(l.UnitId) && (l.Status == LeaseStatus.Active || l.Status == LeaseStatus.MoveOutNotice));
        if (plan.IsActive && !otherActivePlan && liveUsage)
        {
            return Result<RatePlanItemDto>.Failure(PropertyCatalogRules.InUse("RatePlan", plan.Code, "live reservations, stays or leases on its unit type and no other active plan"));
        }

        var dto = GetRatePlan(propertyId, ratePlanId).Value!;
        _dbContext.RatePlans.Remove(plan);
        _dbContext.SaveChanges();
        return Result<RatePlanItemDto>.Success(dto);
    }

    public Result<UtilityTariffItemDto> DeleteUtilityTariff(Guid propertyId, Guid tariffId)
    {
        var tariff = _dbContext.PropertyUtilityTariffs.FirstOrDefault(t => t.Id == tariffId && t.PropertyId == propertyId);
        if (tariff is null)
        {
            return Result<UtilityTariffItemDto>.Failure(RateCatalogRules.NotFound("UtilityTariff", propertyId, tariffId));
        }

        if (_dbContext.Leases.Any(l => l.PropertyId == propertyId && (l.Status == LeaseStatus.Active || l.Status == LeaseStatus.MoveOutNotice)))
        {
            return Result<UtilityTariffItemDto>.Failure(PropertyCatalogRules.InUse("UtilityTariff", tariff.UtilityType.ToString(), "active leases that are billed with it"));
        }

        var dto = GetUtilityTariff(propertyId, tariffId).Value!;
        _dbContext.PropertyUtilityTariffs.Remove(tariff);
        _dbContext.SaveChanges();
        return Result<UtilityTariffItemDto>.Success(dto);
    }

    public Result<TaxProfileItemDto> DeleteTaxProfile(Guid propertyId, Guid taxProfileId)
    {
        var profile = _dbContext.TaxProfiles.FirstOrDefault(t => t.Id == taxProfileId && t.PropertyId == propertyId);
        if (profile is null)
        {
            return Result<TaxProfileItemDto>.Failure(RateCatalogRules.NotFound("TaxProfile", propertyId, taxProfileId));
        }

        var code = profile.ChargeCategoryCode;
        if (RateCatalogRules.ProtectedTaxCodes.Contains(code)
            || _dbContext.Set<Domain.Billing.InvoiceLine>().Any(l => l.ChargeCategoryCode == code))
        {
            return Result<TaxProfileItemDto>.Failure(PropertyCatalogRules.InUse("TaxProfile", code, "a system charge category or invoice lines using it"));
        }

        var dto = GetTaxProfile(propertyId, taxProfileId).Value!;
        _dbContext.TaxProfiles.Remove(profile);
        _dbContext.SaveChanges();
        return Result<TaxProfileItemDto>.Success(dto);
    }

    private Result<T> PickFromHierarchy<T>(Guid propertyId, Func<PropertyHierarchyResponse, T?> pick, Error notFound)
        where T : class
    {
        var hierarchy = GetPropertyHierarchy(propertyId);
        if (hierarchy.IsFailure || hierarchy.Value is null)
        {
            return Result<T>.Failure(hierarchy.Error!);
        }

        return pick(hierarchy.Value) is { } item ? Result<T>.Success(item) : Result<T>.Failure(notFound);
    }

    private Result<T> PickFromCatalog<T>(Guid propertyId, Func<PropertyRateCatalogResponse, T?> pick, Error notFound)
        where T : class
    {
        var catalog = GetPropertyRateCatalog(propertyId);
        if (catalog.IsFailure || catalog.Value is null)
        {
            return Result<T>.Failure(catalog.Error!);
        }

        return pick(catalog.Value) is { } item ? Result<T>.Success(item) : Result<T>.Failure(notFound);
    }
}
