using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Reservations;

public sealed record AssignableUnitOptionDto(
    Guid Id,
    string UnitNumber,
    LocalizedTextDto BuildingName,
    int FloorNumber,
    string ConditionStatus);
