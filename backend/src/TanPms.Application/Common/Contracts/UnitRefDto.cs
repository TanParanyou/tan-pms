namespace TanPms.Application.Common.Contracts;

public sealed record UnitRefDto(
    Guid Id,
    string UnitNumber,
    LocalizedTextDto BuildingName,
    int FloorNumber,
    LocalizedTextDto UnitTypeName);
