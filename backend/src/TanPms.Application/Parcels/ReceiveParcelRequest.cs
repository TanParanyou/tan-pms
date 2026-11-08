namespace TanPms.Application.Parcels;

public sealed record ReceiveParcelRequest(
    Guid UnitId,
    string CarrierName,
    string? TrackingNumber = null,
    string? PhotoFileKey = null);
