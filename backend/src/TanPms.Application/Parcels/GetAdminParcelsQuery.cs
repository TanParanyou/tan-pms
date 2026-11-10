namespace TanPms.Application.Parcels;

public sealed record GetAdminParcelsQuery(
    Guid PropertyId,
    string? Status,
    int? Page = null,
    int? PageSize = null);
