using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Cashier;

public sealed record CancelAdminCashierShiftCommand(
    Guid PropertyId,
    Guid ShiftId,
    ReasonRequest Request);
