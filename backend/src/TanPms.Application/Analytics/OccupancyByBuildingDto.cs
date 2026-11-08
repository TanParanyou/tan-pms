using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Analytics;

public sealed record OccupancyByBuildingDto(
    Guid BuildingId,
    LocalizedTextDto BuildingName,
    int Units,
    int AvailableUnitNights,
    int OccupiedUnitNights,
    decimal OccupancyRate);
