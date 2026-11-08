namespace TanPms.Application.Analytics;

public sealed record OccupancyReportDto(
    DateOnly From,
    DateOnly To,
    int Nights,
    int TotalUnits,
    int AvailableUnitNights,
    int OccupiedUnitNights,
    decimal OccupancyRate,
    IReadOnlyList<OccupancyByStayModeDto> ByStayMode,
    IReadOnlyList<OccupancyByBuildingDto> ByBuilding);
