namespace TanPms.Application.Reservations;

public sealed record CreateClientHoldReservationRequest(
    Guid PropertyId,
    Guid UnitTypeId,
    Guid? UnitId,
    string StayMode,
    DateTimeOffset SlotStartAt,
    DateTimeOffset SlotEndAt);
