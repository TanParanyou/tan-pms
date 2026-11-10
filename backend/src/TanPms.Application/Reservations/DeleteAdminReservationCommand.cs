namespace TanPms.Application.Reservations;

public sealed record DeleteAdminReservationCommand(
    Guid PropertyId,
    Guid ReservationId);
