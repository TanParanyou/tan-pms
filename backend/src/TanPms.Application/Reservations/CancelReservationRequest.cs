namespace TanPms.Application.Reservations;

public sealed record CancelReservationRequest(
    string Reason,
    bool MarkNoShow);
