namespace TanPms.Application.Reservations;

public sealed record ConfirmAdminReservationCommand(
    Guid PropertyId,
    Guid ReservationId);
