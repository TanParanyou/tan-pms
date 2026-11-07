using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Reservations;

public sealed record AvailabilitySearchResponse(
    PropertyRefDto Property,
    string StayMode,
    DateTimeOffset SlotStartAt,
    DateTimeOffset SlotEndAt,
    IReadOnlyList<UnitTypeAvailabilityDto> Items);
