namespace TanPms.Application.Parcels;

public sealed record UpdateAdminParcelCommand(
    Guid PropertyId,
    Guid ParcelId,
    ReceiveParcelRequest Request);
