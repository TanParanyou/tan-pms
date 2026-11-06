namespace TanPms.Application.Properties;

public sealed record UpsertUnitMasterRequest(
    Guid? Id,
    Guid BuildingId,
    Guid FloorId,
    Guid UnitTypeId,
    string UnitNumber,
    IReadOnlyList<string> SupportedStayModes,
    string ConditionStatus,
    IReadOnlyList<UpsertUnitAssetItemDto> Assets);
