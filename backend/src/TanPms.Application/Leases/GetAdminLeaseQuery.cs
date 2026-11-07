namespace TanPms.Application.Leases;

public sealed record GetAdminLeaseQuery(
    Guid PropertyId,
    Guid LeaseId);
