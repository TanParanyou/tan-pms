namespace TanPms.Application.Parcels;

public sealed record GetAdminParcelQuery(
    Guid PropertyId,
    Guid ParcelId);
