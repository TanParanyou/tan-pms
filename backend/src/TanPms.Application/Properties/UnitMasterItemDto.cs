namespace TanPms.Application.Properties;

public sealed record UnitMasterItemDto(
    Guid Id,
    string UnitNumber,
    BuildingRefDto Building,
    FloorRefDto Floor,
    UnitTypeRefDto UnitType,
    string OccupancyStatus,
    string ConditionStatus,
    IReadOnlyList<string> SupportedStayModes,
    IReadOnlyList<UnitAssetDto> Assets);
