namespace TanPms.Application.Leases;

public sealed record CancelAdminLeaseCommand(
    Guid PropertyId,
    Guid LeaseId,
    CancelLeaseRequest Request);
