namespace TanPms.Application.Analytics;

public sealed record OccupancyByStayModeDto(
    string StayMode,
    int OccupiedUnitNights,
    decimal OccupancyRate);
