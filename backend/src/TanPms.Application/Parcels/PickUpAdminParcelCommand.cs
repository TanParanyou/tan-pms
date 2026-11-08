namespace TanPms.Application.Parcels;

public sealed record PickUpAdminParcelCommand(
    Guid PropertyId,
    Guid ParcelId,
    PickUpParcelRequest Request);
