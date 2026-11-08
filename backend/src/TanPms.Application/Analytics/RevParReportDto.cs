namespace TanPms.Application.Analytics;

// Room revenue is ex-VAT; deposits and non-room charges are excluded by construction.
public sealed record RevParReportDto(
    DateOnly From,
    DateOnly To,
    int AvailableUnitNights,
    decimal FolioRoomRevenue,
    decimal LeaseRentRevenue,
    decimal RoomRevenue,
    decimal RevPar);
