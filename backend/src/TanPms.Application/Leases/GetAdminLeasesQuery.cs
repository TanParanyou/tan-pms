namespace TanPms.Application.Leases;

public sealed record GetAdminLeasesQuery(
    Guid PropertyId,
    string? Status,
    string? LicensePlate);
