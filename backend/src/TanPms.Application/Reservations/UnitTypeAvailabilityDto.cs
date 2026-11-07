using TanPms.Application.Properties;

namespace TanPms.Application.Reservations;

public sealed record UnitTypeAvailabilityDto(
    UnitTypeRefDto UnitType,
    IReadOnlyList<string> SupportedStayModes,
    int TotalPhysicalUnits,
    int UnassignedQuotaHeld,
    int NetAvailableQuota,
    int TurnaroundBufferMinutes,
    decimal EstimatedRoomRate,
    decimal EstimatedDepositAmount,
    IReadOnlyList<AssignableUnitOptionDto> AvailableUnits);
