using TanPms.Application.Common.Contracts;

namespace TanPms.Application.ClientPortal;

public sealed record ClientHoldReservationDto(
    string DocumentNumber,
    LocalizedTextDto UnitTypeName,
    string StayMode,
    DateTimeOffset HoldExpiresAt,
    decimal DepositAmount);
