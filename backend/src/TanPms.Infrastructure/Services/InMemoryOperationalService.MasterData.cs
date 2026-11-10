using TanPms.Application.Common.Contracts;
using TanPms.Application.Common.Results;
using TanPms.Application.Identity;
using TanPms.Application.Properties;
using TanPms.Application.Rates;
using TanPms.Domain.Common;
using TanPms.Domain.Properties;
using TanPms.Domain.Reservations;
using TanPms.Domain.Stays;

namespace TanPms.Infrastructure.Services;

public sealed partial class InMemoryOperationalService
{
    public Result<AdminUserDto> GetAdminUser(Guid userId)
    {
        lock (_syncRoot)
        {
            var user = _adminUsers.FirstOrDefault(u => u.Id == userId);
            return user is null
                ? Result<AdminUserDto>.Failure(IdentityRules.NotFound(userId))
                : Result<AdminUserDto>.Success(MapAdminUserDto(user));
        }
    }

    public Result<AdminUserDto> SetAdminUserActive(Guid userId, bool isActive)
    {
        lock (_syncRoot)
        {
            var user = _adminUsers.FirstOrDefault(u => u.Id == userId);
            if (user is null)
            {
                return Result<AdminUserDto>.Failure(IdentityRules.NotFound(userId));
            }

            if (IdentityRules.CheckKeepsAnOrganizationAdmin(user, isActive, user.RoleCode, _adminUsers) is { } adminError)
            {
                return Result<AdminUserDto>.Failure(adminError);
            }

            user.IsActive = isActive;
            Touch(user);
            return Result<AdminUserDto>.Success(MapAdminUserDto(user));
        }
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
        lock (_syncRoot)
        {
            if (_buildings.Values.Any(b => b.PropertyId == propertyId && b.Code == code && b.Id != request.Id))
            {
                return Result<BuildingDetailDto>.Failure(PropertyCatalogRules.DuplicateCode("Building", code));
            }

            try
            {
                var name = LocalizedText.Create(request.Name.Th, request.Name.En);
                Building? building = null;
                if (request.Id.HasValue && (!_buildings.TryGetValue(request.Id.Value, out building) || building.PropertyId != propertyId))
                {
                    return Result<BuildingDetailDto>.Failure(PropertyCatalogRules.NotFound("Building", propertyId, request.Id.Value));
                }

                building ??= new Building { PropertyId = propertyId, Code = code, Name = name };
                building.Code = code;
                building.Name = name;
                _buildings[building.Id] = building;
                Touch(building);
                RefreshUnitRefsLocked(propertyId);
                var id = building.Id;
                return PickFromHierarchy(propertyId, h => h.Buildings.FirstOrDefault(b => b.Id == id), PropertyCatalogRules.NotFound("Building", propertyId, id));
            }
            catch (DomainRuleException ex)
            {
                return Result<BuildingDetailDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
        }
    }

    public Result<FloorDetailDto> UpsertFloor(Guid propertyId, UpsertFloorRequest request)
    {
        if (PropertyCatalogRules.ValidateFloor(request) is { } validationError)
        {
            return Result<FloorDetailDto>.Failure(validationError);
        }

        lock (_syncRoot)
        {
            if (!_buildings.TryGetValue(request.BuildingId, out var building) || building.PropertyId != propertyId)
            {
                return Result<FloorDetailDto>.Failure(PropertyCatalogRules.NotFound("Building", propertyId, request.BuildingId));
            }

            if (_floors.Values.Any(f => f.BuildingId == request.BuildingId && f.FloorNumber == request.FloorNumber && f.Id != request.Id))
            {
                return Result<FloorDetailDto>.Failure(PropertyCatalogRules.DuplicateCode("Floor", request.FloorNumber.ToString(System.Globalization.CultureInfo.InvariantCulture)));
            }

            try
            {
                var name = LocalizedText.Create(request.Name.Th, request.Name.En);
                Floor? floor = null;
                if (request.Id.HasValue && (!_floors.TryGetValue(request.Id.Value, out floor) || floor.PropertyId != propertyId))
                {
                    return Result<FloorDetailDto>.Failure(PropertyCatalogRules.NotFound("Floor", propertyId, request.Id.Value));
                }

                if (floor is not null && floor.BuildingId != request.BuildingId && _units.Values.Any(u => u.FloorId == floor.Id))
                {
                    return Result<FloorDetailDto>.Failure(PropertyCatalogRules.InUse("Floor", floor.FloorNumber.ToString(System.Globalization.CultureInfo.InvariantCulture), "units and cannot move to another building"));
                }

                floor ??= new Floor { PropertyId = propertyId, BuildingId = request.BuildingId, FloorNumber = request.FloorNumber, Name = name };
                floor.BuildingId = request.BuildingId;
                floor.FloorNumber = request.FloorNumber;
                floor.Name = name;
                _floors[floor.Id] = floor;
                Touch(floor);
                RefreshUnitRefsLocked(propertyId);
                var id = floor.Id;
                return PickFromHierarchy(propertyId, h => h.Buildings.SelectMany(b => b.Floors).FirstOrDefault(f => f.Id == id), PropertyCatalogRules.NotFound("Floor", propertyId, id));
            }
            catch (DomainRuleException ex)
            {
                return Result<FloorDetailDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
        }
    }

    public Result<UnitTypeDetailDto> UpsertUnitType(Guid propertyId, UpsertUnitTypeRequest request)
    {
        if (PropertyCatalogRules.ValidateUnitType(request, out var stayModes) is { } validationError)
        {
            return Result<UnitTypeDetailDto>.Failure(validationError);
        }

        var code = request.Code.Trim().ToUpperInvariant();
        lock (_syncRoot)
        {
            if (_unitTypes.Values.Any(t => t.PropertyId == propertyId && t.Code == code && t.Id != request.Id))
            {
                return Result<UnitTypeDetailDto>.Failure(PropertyCatalogRules.DuplicateCode("UnitType", code));
            }

            try
            {
                UnitType? unitType = null;
                if (request.Id.HasValue && (!_unitTypes.TryGetValue(request.Id.Value, out unitType) || unitType.PropertyId != propertyId))
                {
                    return Result<UnitTypeDetailDto>.Failure(PropertyCatalogRules.NotFound("UnitType", propertyId, request.Id.Value));
                }

                unitType ??= new UnitType { PropertyId = propertyId, Code = code, Name = LocalizedText.Create(request.Name.Th, request.Name.En) };
                UnitTypeComposer.Apply(unitType, code, request, stayModes);
                _unitTypes[unitType.Id] = unitType;
                Touch(unitType);
                RefreshUnitRefsLocked(propertyId);
                var id = unitType.Id;
                return PickFromHierarchy(propertyId, h => h.UnitTypes.FirstOrDefault(t => t.Id == id), PropertyCatalogRules.NotFound("UnitType", propertyId, id));
            }
            catch (DomainRuleException ex)
            {
                return Result<UnitTypeDetailDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
        }
    }

    public Result<UnitMasterItemDto> DeleteUnitMaster(Guid propertyId, Guid unitId)
    {
        lock (_syncRoot)
        {
            if (!_units.TryGetValue(unitId, out var unit) || unit.PropertyId != propertyId)
            {
                return Result<UnitMasterItemDto>.Failure(PropertyCatalogRules.NotFound("Unit", propertyId, unitId));
            }

            var usage = new List<string>();
            if (_leases.Any(l => l.UnitId == unitId)) usage.Add("leases");
            if (_stays.Any(s => s.UnitId == unitId)) usage.Add("stays");
            if (_reservations.Any(r => r.UnitId == unitId)) usage.Add("reservations");
            if (_housekeepingTasks.Any(t => t.UnitId == unitId)) usage.Add("housekeeping history");
            if (_meterReadings.Any(r => r.UnitId == unitId)) usage.Add("meter readings");
            if (_workOrders.Any(w => w.UnitId == unitId)) usage.Add("work orders");
            if (_parcels.Any(p => p.UnitId == unitId)) usage.Add("parcels");
            if (usage.Count > 0)
            {
                return Result<UnitMasterItemDto>.Failure(PropertyCatalogRules.InUse("Unit", unit.UnitNumber, string.Join(", ", usage)));
            }

            var dto = GetUnitMaster(propertyId, unitId).Value!;
            _units.Remove(unitId);
            return Result<UnitMasterItemDto>.Success(dto);
        }
    }

    public Result<BuildingDetailDto> DeleteBuilding(Guid propertyId, Guid buildingId)
    {
        lock (_syncRoot)
        {
            if (!_buildings.TryGetValue(buildingId, out var building) || building.PropertyId != propertyId)
            {
                return Result<BuildingDetailDto>.Failure(PropertyCatalogRules.NotFound("Building", propertyId, buildingId));
            }

            if (_floors.Values.Any(f => f.BuildingId == buildingId) || _units.Values.Any(u => u.BuildingId == buildingId))
            {
                return Result<BuildingDetailDto>.Failure(PropertyCatalogRules.InUse("Building", building.Code, "floors or units"));
            }

            var dto = PickFromHierarchy(propertyId, h => h.Buildings.FirstOrDefault(b => b.Id == buildingId), PropertyCatalogRules.NotFound("Building", propertyId, buildingId)).Value!;
            _buildings.Remove(buildingId);
            return Result<BuildingDetailDto>.Success(dto);
        }
    }

    public Result<FloorDetailDto> DeleteFloor(Guid propertyId, Guid floorId)
    {
        lock (_syncRoot)
        {
            if (!_floors.TryGetValue(floorId, out var floor) || floor.PropertyId != propertyId)
            {
                return Result<FloorDetailDto>.Failure(PropertyCatalogRules.NotFound("Floor", propertyId, floorId));
            }

            if (_units.Values.Any(u => u.FloorId == floorId))
            {
                return Result<FloorDetailDto>.Failure(PropertyCatalogRules.InUse("Floor", floor.FloorNumber.ToString(System.Globalization.CultureInfo.InvariantCulture), "units"));
            }

            var dto = PickFromHierarchy(propertyId, h => h.Buildings.SelectMany(b => b.Floors).FirstOrDefault(f => f.Id == floorId), PropertyCatalogRules.NotFound("Floor", propertyId, floorId)).Value!;
            _floors.Remove(floorId);
            return Result<FloorDetailDto>.Success(dto);
        }
    }

    public Result<UnitTypeDetailDto> DeleteUnitType(Guid propertyId, Guid unitTypeId)
    {
        lock (_syncRoot)
        {
            if (!_unitTypes.TryGetValue(unitTypeId, out var unitType) || unitType.PropertyId != propertyId)
            {
                return Result<UnitTypeDetailDto>.Failure(PropertyCatalogRules.NotFound("UnitType", propertyId, unitTypeId));
            }

            if (_units.Values.Any(u => u.UnitTypeId == unitTypeId)
                || _ratePlans.Values.Any(p => p.UnitTypeId == unitTypeId)
                || _reservations.Any(r => r.UnitTypeId == unitTypeId))
            {
                return Result<UnitTypeDetailDto>.Failure(PropertyCatalogRules.InUse("UnitType", unitType.Code, "units, rate plans or reservations"));
            }

            var dto = PickFromHierarchy(propertyId, h => h.UnitTypes.FirstOrDefault(t => t.Id == unitTypeId), PropertyCatalogRules.NotFound("UnitType", propertyId, unitTypeId)).Value!;
            _unitTypes.Remove(unitTypeId);
            return Result<UnitTypeDetailDto>.Success(dto);
        }
    }

    public Result<RatePlanItemDto> GetRatePlan(Guid propertyId, Guid ratePlanId) =>
        PickFromCatalog(propertyId, c => c.RatePlans.FirstOrDefault(p => p.Id == ratePlanId), RateCatalogRules.NotFound("RatePlan", propertyId, ratePlanId));

    public Result<UtilityTariffItemDto> GetUtilityTariff(Guid propertyId, Guid tariffId) =>
        PickFromCatalog(propertyId, c => c.UtilityTariffs.FirstOrDefault(t => t.Id == tariffId), RateCatalogRules.NotFound("UtilityTariff", propertyId, tariffId));

    public Result<TaxProfileItemDto> GetTaxProfile(Guid propertyId, Guid taxProfileId) =>
        PickFromCatalog(propertyId, c => c.TaxProfiles.FirstOrDefault(t => t.Id == taxProfileId), RateCatalogRules.NotFound("TaxProfile", propertyId, taxProfileId));

    public Result<RatePlanItemDto> DeleteRatePlan(Guid propertyId, Guid ratePlanId)
    {
        lock (_syncRoot)
        {
            if (!_ratePlans.TryGetValue(ratePlanId, out var plan) || plan.PropertyId != propertyId)
            {
                return Result<RatePlanItemDto>.Failure(RateCatalogRules.NotFound("RatePlan", propertyId, ratePlanId));
            }

            var otherActivePlan = _ratePlans.Values.Any(p => p.UnitTypeId == plan.UnitTypeId && p.Id != plan.Id && p.IsActive);
            var unitIds = _units.Values.Where(u => u.UnitTypeId == plan.UnitTypeId).Select(u => u.Id).ToHashSet();
            var liveUsage = _reservations.Any(r => r.UnitTypeId == plan.UnitTypeId
                    && r.Status is ReservationStatus.Hold or ReservationStatus.PendingVerification or ReservationStatus.Confirmed)
                || _stays.Any(s => unitIds.Contains(s.UnitId) && s.Status == StayStatus.Active)
                || _leases.Any(l => unitIds.Contains(l.UnitId) && l.BlocksUnitAvailability);
            if (plan.IsActive && !otherActivePlan && liveUsage)
            {
                return Result<RatePlanItemDto>.Failure(PropertyCatalogRules.InUse("RatePlan", plan.Code, "live reservations, stays or leases on its unit type and no other active plan"));
            }

            var dto = GetRatePlan(propertyId, ratePlanId).Value!;
            _ratePlans.Remove(ratePlanId);
            return Result<RatePlanItemDto>.Success(dto);
        }
    }

    public Result<UtilityTariffItemDto> DeleteUtilityTariff(Guid propertyId, Guid tariffId)
    {
        lock (_syncRoot)
        {
            if (!_utilityTariffs.TryGetValue(tariffId, out var tariff) || tariff.PropertyId != propertyId)
            {
                return Result<UtilityTariffItemDto>.Failure(RateCatalogRules.NotFound("UtilityTariff", propertyId, tariffId));
            }

            if (_leases.Any(l => l.PropertyId == propertyId && l.BlocksUnitAvailability))
            {
                return Result<UtilityTariffItemDto>.Failure(PropertyCatalogRules.InUse("UtilityTariff", tariff.UtilityType.ToString(), "active leases that are billed with it"));
            }

            var dto = GetUtilityTariff(propertyId, tariffId).Value!;
            _utilityTariffs.Remove(tariffId);
            return Result<UtilityTariffItemDto>.Success(dto);
        }
    }

    public Result<TaxProfileItemDto> DeleteTaxProfile(Guid propertyId, Guid taxProfileId)
    {
        lock (_syncRoot)
        {
            if (!_taxProfiles.TryGetValue(taxProfileId, out var profile) || profile.PropertyId != propertyId)
            {
                return Result<TaxProfileItemDto>.Failure(RateCatalogRules.NotFound("TaxProfile", propertyId, taxProfileId));
            }

            var code = profile.ChargeCategoryCode;
            if (RateCatalogRules.ProtectedTaxCodes.Contains(code) || _invoices.SelectMany(i => i.Lines).Any(l => l.ChargeCategoryCode == code))
            {
                return Result<TaxProfileItemDto>.Failure(PropertyCatalogRules.InUse("TaxProfile", code, "a system charge category or invoice lines using it"));
            }

            var dto = GetTaxProfile(propertyId, taxProfileId).Value!;
            _taxProfiles.Remove(taxProfileId);
            return Result<TaxProfileItemDto>.Success(dto);
        }
    }

    // Mirrors AuditableEntityInterceptor: in-memory mutations stamp UpdatedAt/UpdatedBy like EF's Modified entries.
    private static void Touch(AuditableEntity entity, DateTimeOffset? at = null)
    {
        entity.UpdatedAt = at ?? DateTimeOffset.UtcNow;
        entity.UpdatedBy = "system";
    }

    private void RefreshUnitRefsLocked(Guid propertyId)
    {
        foreach (var unit in _units.Values.Where(u => u.PropertyId == propertyId))
        {
            if (_buildings.TryGetValue(unit.BuildingId, out var building)
                && _floors.TryGetValue(unit.FloorId, out var floor)
                && _unitTypes.TryGetValue(unit.UnitTypeId, out var unitType))
            {
                _unitRefs[unit.Id] = new UnitRefDto(
                    unit.Id,
                    unit.UnitNumber,
                    LocalizedTextDto.FromDomain(building.Name),
                    floor.FloorNumber,
                    LocalizedTextDto.FromDomain(unitType.Name));
            }
        }
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
