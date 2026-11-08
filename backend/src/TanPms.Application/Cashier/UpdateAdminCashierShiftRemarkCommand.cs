namespace TanPms.Application.Cashier;

public sealed record UpdateAdminCashierShiftRemarkCommand(
    Guid PropertyId,
    Guid ShiftId,
    UpdateCashierShiftRemarkRequest Request);
