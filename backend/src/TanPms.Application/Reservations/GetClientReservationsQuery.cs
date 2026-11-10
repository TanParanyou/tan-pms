namespace TanPms.Application.Reservations;

public sealed record GetClientReservationsQuery(
    int? Page = null,
    int? PageSize = null);
