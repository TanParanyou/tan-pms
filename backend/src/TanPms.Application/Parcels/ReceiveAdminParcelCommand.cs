namespace TanPms.Application.Parcels;

public sealed record ReceiveAdminParcelCommand(
    Guid PropertyId,
    ReceiveParcelRequest Request);
