namespace TanPms.Application.Reservations;

public sealed record GetClientAvailabilityQuery(
    Guid PropertyId,
    string StayMode,
    DateTimeOffset SlotStartAt,
    DateTimeOffset SlotEndAt);
