namespace TanPms.Application.Leases;

public sealed record SettleAdminLeaseMoveOutCommand(
    Guid PropertyId,
    Guid LeaseId,
    SettleLeaseMoveOutRequest Request);
