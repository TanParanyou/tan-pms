using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Stays;

public sealed record StayDetailDto(
    Guid Id,
    string DocumentNumber,
    PropertyRefDto Property,
    UnitRefDto Unit,
    CustomerRefDto Customer,
    string? ReservationDocumentNumber,
    string StayMode,
    string Status,
    DateTimeOffset CheckInAt,
    DateTimeOffset? ExpectedCheckOutAt,
    DateTimeOffset? CheckOutAt,
    int? RemainingMinutes,
    bool IsOvertime,
    decimal KeyDepositAmount,
    decimal KeyDepositBalance,
    FolioSummaryDto Folio,
    IReadOnlyList<StayOccupantDto> Occupants,
    string? GeneratedHousekeepingTaskStatus,
    string? Note,
    string? CancelReason);
