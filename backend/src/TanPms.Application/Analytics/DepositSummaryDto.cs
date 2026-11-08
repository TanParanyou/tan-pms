namespace TanPms.Application.Analytics;

// Deposits are a liability held for customers (Classification = "Liability"), never revenue.
public sealed record DepositSummaryDto(
    DateOnly From,
    DateOnly To,
    string Classification,
    decimal TotalHeldBalance,
    IReadOnlyList<DepositTypeSummaryDto> ByType);
