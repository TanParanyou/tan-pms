namespace TanPms.Application.Stays;

public sealed record StayListResponse(
    IReadOnlyList<StayDetailDto> Items);
