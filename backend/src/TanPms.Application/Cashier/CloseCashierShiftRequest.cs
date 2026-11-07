namespace TanPms.Application.Cashier;

public sealed record CloseCashierShiftRequest(
    decimal ActualCashCounted,
    string? VarianceRemark = null);
