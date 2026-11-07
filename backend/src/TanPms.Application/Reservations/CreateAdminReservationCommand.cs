namespace TanPms.Application.Reservations;

public sealed record CreateAdminReservationCommand(
    Guid PropertyId,
    CreateAdminReservationRequest Request);
