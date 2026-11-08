namespace TanPms.Application.Analytics;

public sealed record GetAdminDepositSummaryReportQuery(
    Guid PropertyId,
    DateOnly? From,
    DateOnly? To);
