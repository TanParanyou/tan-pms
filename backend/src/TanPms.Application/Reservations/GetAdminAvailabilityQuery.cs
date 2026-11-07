namespace TanPms.Application.Reservations;

public sealed record GetAdminAvailabilityQuery(
    Guid PropertyId,
    string StayMode,
    DateTimeOffset SlotStartAt,
    DateTimeOffset SlotEndAt);
