using TanPms.Application.Common.Results;

namespace TanPms.Application.Properties;

public interface IPropertyCatalogStore
{
    Result<PropertyHierarchyResponse> GetPropertyHierarchy(Guid propertyId);
    Result<UnitMasterItemDto> UpsertUnitMaster(Guid propertyId, UpsertUnitMasterRequest request);

    Result<UnitMasterItemDto> GetUnitMaster(Guid propertyId, Guid unitId);

    Result<BuildingDetailDto> UpsertBuilding(Guid propertyId, UpsertBuildingRequest request);

    Result<FloorDetailDto> UpsertFloor(Guid propertyId, UpsertFloorRequest request);

    Result<UnitTypeDetailDto> UpsertUnitType(Guid propertyId, UpsertUnitTypeRequest request);

    Result<UnitMasterItemDto> DeleteUnitMaster(Guid propertyId, Guid unitId);

    Result<BuildingDetailDto> DeleteBuilding(Guid propertyId, Guid buildingId);

    Result<FloorDetailDto> DeleteFloor(Guid propertyId, Guid floorId);

    Result<UnitTypeDetailDto> DeleteUnitType(Guid propertyId, Guid unitTypeId);
}
