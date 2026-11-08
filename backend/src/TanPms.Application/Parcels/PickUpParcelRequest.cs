namespace TanPms.Application.Parcels;

public sealed record PickUpParcelRequest(
    string? RecipientName = null);
