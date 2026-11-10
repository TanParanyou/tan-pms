namespace TanPms.Application.Parcels;

public sealed record GetClientParcelsQuery(
    string? Status,
    int? Page = null,
    int? PageSize = null);
