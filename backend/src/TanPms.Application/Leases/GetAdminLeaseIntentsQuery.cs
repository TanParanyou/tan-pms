namespace TanPms.Application.Leases;

public sealed record GetAdminLeaseIntentsQuery(
    Guid PropertyId,
    string? Status,
    int? Page = null,
    int? PageSize = null);
