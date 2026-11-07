namespace TanPms.Application.Leases;

public sealed record RenewAdminLeaseCommand(
    Guid PropertyId,
    Guid LeaseId,
    RenewLeaseRequest Request);
