namespace TanPms.Application.Analytics;

public sealed record GetAdminOccupancyReportQuery(
    Guid PropertyId,
    DateOnly? From,
    DateOnly? To);
