namespace TanPms.Application.Cashier;

public sealed record OpenAdminCashierShiftCommand(
    Guid PropertyId,
    OpenCashierShiftRequest Request);
