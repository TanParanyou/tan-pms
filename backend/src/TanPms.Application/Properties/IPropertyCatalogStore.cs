using TanPms.Application.Common.Results;

namespace TanPms.Application.Properties;

public interface IPropertyCatalogStore
{
    Result<PropertyHierarchyResponse> GetPropertyHierarchy(Guid propertyId);
    Result<UnitMasterItemDto> UpsertUnitMaster(Guid propertyId, UpsertUnitMasterRequest request);
}
