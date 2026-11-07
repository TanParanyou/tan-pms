namespace TanPms.Domain.Reservations;

public sealed record UnitTypeAvailabilityResult(
    Guid UnitTypeId,
    int TotalPhysicalUnits,
    int UnassignedQuotaHeld,
    int NetAvailableQuota,
    int TurnaroundBufferMinutes,
    IReadOnlyList<Guid> AvailableUnitIds);
