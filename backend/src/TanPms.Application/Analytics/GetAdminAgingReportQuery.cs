namespace TanPms.Application.Analytics;

public sealed record GetAdminAgingReportQuery(
    Guid PropertyId,
    DateOnly? From,
    DateOnly? To);
