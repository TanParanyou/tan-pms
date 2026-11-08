namespace TanPms.Application.Analytics;

public sealed record GetAdminCashierShiftSummaryReportQuery(
    Guid PropertyId,
    DateOnly? From,
    DateOnly? To);
