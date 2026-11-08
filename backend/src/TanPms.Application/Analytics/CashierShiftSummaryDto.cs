namespace TanPms.Application.Analytics;

public sealed record CashierShiftSummaryDto(
    DateOnly From,
    DateOnly To,
    int ShiftCount,
    int OpenCount,
    int ClosedCount,
    int ReconciledCount,
    int CancelledCount,
    decimal CashReceiptsTotal,
    decimal DepositsReceivedTotal,
    decimal DepositsRefundedTotal,
    decimal VarianceTotal,
    int ShiftsWithVariance,
    int ReceiptCount,
    decimal ReceiptNetTotal,
    IReadOnlyList<CashierShiftSummaryRowDto> Cashiers);
