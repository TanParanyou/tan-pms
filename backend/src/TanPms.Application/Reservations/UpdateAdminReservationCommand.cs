namespace TanPms.Application.Reservations;

public sealed record UpdateAdminReservationCommand(
    Guid PropertyId,
    Guid ReservationId,
    UpdateReservationRequest Request);
