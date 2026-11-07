namespace TanPms.Application.Cashier;

public sealed record CloseAdminCashierShiftCommand(
    Guid PropertyId,
    Guid ShiftId,
    CloseCashierShiftRequest Request);
