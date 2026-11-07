namespace TanPms.Application.Reservations;

public sealed record SubmitClientReservationSlipCommand(
    Guid ReservationId,
    SubmitReservationSlipRequest Request);
