namespace TanPms.Application.Parcels;

public sealed record ParcelListResponse(
    IReadOnlyList<ParcelItemDto> Items);
