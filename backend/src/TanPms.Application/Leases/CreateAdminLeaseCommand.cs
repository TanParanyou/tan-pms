namespace TanPms.Application.Leases;

public sealed record CreateAdminLeaseCommand(
    Guid PropertyId,
    CreateLeaseRequest Request);
