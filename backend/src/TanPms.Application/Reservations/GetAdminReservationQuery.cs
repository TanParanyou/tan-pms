namespace TanPms.Application.Reservations;

public sealed record GetAdminReservationQuery(
    Guid PropertyId,
    Guid ReservationId);
