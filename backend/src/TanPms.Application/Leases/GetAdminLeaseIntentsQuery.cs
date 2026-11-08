namespace TanPms.Application.Leases;

public sealed record GetAdminLeaseIntentsQuery(
    Guid PropertyId,
    string? Status);
