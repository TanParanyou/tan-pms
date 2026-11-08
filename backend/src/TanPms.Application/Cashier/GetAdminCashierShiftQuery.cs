namespace TanPms.Application.Cashier;

public sealed record GetAdminCashierShiftQuery(
    Guid PropertyId,
    Guid ShiftId);
