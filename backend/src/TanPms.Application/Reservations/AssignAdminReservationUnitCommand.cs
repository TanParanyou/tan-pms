namespace TanPms.Application.Reservations;

public sealed record AssignAdminReservationUnitCommand(
    Guid PropertyId,
    Guid ReservationId,
    AssignReservationUnitRequest Request);
