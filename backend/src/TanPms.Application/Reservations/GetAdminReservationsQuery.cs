namespace TanPms.Application.Reservations;

public sealed record GetAdminReservationsQuery(
    Guid PropertyId,
    string? Status,
    string? StayMode);
