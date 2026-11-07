namespace TanPms.Application.Cashier;

public sealed record ReconcileAdminCashierShiftCommand(
    Guid PropertyId,
    Guid ShiftId,
    ReconcileCashierShiftRequest Request);
