namespace TanPms.Application.Properties;

public sealed record PropertyHierarchyResponse(
    PropertyDetailDto Property,
    IReadOnlyList<BuildingDetailDto> Buildings,
    IReadOnlyList<UnitTypeDetailDto> UnitTypes,
    IReadOnlyList<UnitMasterItemDto> Units);
