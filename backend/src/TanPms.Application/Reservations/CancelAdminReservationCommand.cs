namespace TanPms.Application.Reservations;

public sealed record CancelAdminReservationCommand(
    Guid PropertyId,
    Guid ReservationId,
    CancelReservationRequest Request);
