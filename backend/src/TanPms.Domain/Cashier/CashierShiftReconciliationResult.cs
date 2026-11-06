namespace TanPms.Domain.Cashier;

public sealed record CashierShiftReconciliationResult(
    decimal ExpectedDrawerCash,
    decimal ActualCashCounted,
    decimal CashVariance);
