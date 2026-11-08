namespace TanPms.Application.Analytics;

public sealed record DepositTypeSummaryDto(
    string DepositType,
    int LedgerCount,
    decimal HeldBalance,
    decimal ReceivedInPeriod,
    decimal DeductedInPeriod,
    decimal RefundedInPeriod);
