using TanPms.Application.Common.Contracts;
using TanPms.Application.Properties;

namespace TanPms.Application.Reservations;

public sealed record ReservationItemDto(
    Guid Id,
    string DocumentNumber,
    PropertyRefDto Property,
    CustomerRefDto Customer,
    UnitTypeRefDto UnitType,
    UnitRefDto? AssignedUnit,
    string StayMode,
    DateTimeOffset SlotStartAt,
    DateTimeOffset SlotEndAt,
    DateTimeOffset EffectiveBlockedEndAt,
    DateTimeOffset HoldExpiresAt,
    decimal DepositAmount,
    string? PaymentSlipFileKey,
    string? CancellationReason,
    string Status);
