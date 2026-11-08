using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Reservations;

public sealed record CancelClientReservationCommand(
    Guid ReservationId,
    ReasonRequest Request);
