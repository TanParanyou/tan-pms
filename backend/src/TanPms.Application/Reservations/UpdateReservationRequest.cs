namespace TanPms.Application.Reservations;

public sealed record UpdateReservationRequest(
    Guid UnitTypeId,
    Guid? UnitId,
    DateTimeOffset SlotStartAt,
    DateTimeOffset SlotEndAt,
    int? GuestCount = null,
    string? Note = null);
