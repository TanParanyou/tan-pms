namespace TanPms.Application.Reservations;

public sealed record ReservationListResponse(
    IReadOnlyList<ReservationItemDto> Items);
