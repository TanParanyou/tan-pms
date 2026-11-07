namespace TanPms.Application.Cashier;

public sealed record CashierShiftDto(
    Guid Id,
    string DocumentNumber,
    string CashierUserId,
    string Status,
    decimal OpeningFloatCash,
    decimal CashReceiptsInShift,
    decimal CashDepositsReceivedInShift,
    decimal CashDepositsRefundedInShift,
    decimal? ExpectedDrawerCash,
    decimal? ActualCashCounted,
    decimal? CashVariance,
    string? VarianceRemark,
    DateTimeOffset OpenedAt);
