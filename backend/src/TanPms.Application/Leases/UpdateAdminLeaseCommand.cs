namespace TanPms.Application.Leases;

public sealed record UpdateAdminLeaseCommand(
    Guid PropertyId,
    Guid LeaseId,
    UpdateLeaseRequest Request);
