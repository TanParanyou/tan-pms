namespace TanPms.Application.Analytics;

public sealed record GetAdminRevParReportQuery(
    Guid PropertyId,
    DateOnly? From,
    DateOnly? To);
