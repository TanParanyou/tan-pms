using TanPms.Application.Abstractions;

namespace TanPms.Application.Contracts;

public sealed record PropertyRefDto(
    Guid Id,
    string Code,
    string Name);

public sealed record UnitRefDto(
    Guid Id,
    string UnitNumber,
    string BuildingName,
    int FloorNumber,
    string UnitTypeName);

public sealed record CustomerRefDto(
    Guid Id,
    string FullName,
    string MaskedNationalId);

public sealed record RoomRackItemDto(
    UnitRefDto Unit,
    string OccupancyStatus,
    string ConditionStatus,
    IReadOnlyList<string> SupportedStayModes,
    string? ActiveStayMode,
    string? ActiveDocumentNumber,
    CustomerRefDto? Customer,
    int? RemainingMinutes);

public sealed record RoomRackResponse(
    PropertyRefDto Property,
    IReadOnlyList<RoomRackItemDto> Items);

public sealed record CheckInStayRequest(
    Guid PropertyId,
    Guid UnitId,
    Guid CustomerId,
    string StayMode,
    decimal KeyDepositAmount,
    bool OverrideDirtyCheckIn = false,
    string? OverrideReason = null);

public sealed record StaySummaryDto(
    Guid Id,
    string DocumentNumber,
    string StayMode,
    string Status,
    UnitRefDto Unit,
    CustomerRefDto Customer);

public sealed record ClientHoldReservationDto(
    string DocumentNumber,
    string UnitTypeName,
    string StayMode,
    DateTimeOffset HoldExpiresAt,
    decimal DepositAmount);

public sealed record ClientActiveLeaseDto(
    string DocumentNumber,
    UnitRefDto Unit,
    decimal MonthlyRentAmount,
    decimal SecurityDepositBalance);

public sealed record ClientUnpaidInvoiceDto(
    Guid Id,
    string DocumentNumber,
    decimal TotalAmount,
    string Status);

public sealed record ClientPendingParcelDto(
    Guid Id,
    string DocumentNumber,
    string CarrierName,
    DateTimeOffset ArrivedAt);

public sealed record ClientDashboardResponse(
    CustomerRefDto Customer,
    ClientHoldReservationDto? ActiveHoldReservation,
    ClientActiveLeaseDto? ActiveLease,
    IReadOnlyList<ClientUnpaidInvoiceDto> UnpaidInvoices,
    IReadOnlyList<ClientPendingParcelDto> PendingParcels);

public interface IPmsOperationalService
{
    RoomRackResponse GetRoomRack(Guid propertyId, ICurrentUserContext userContext);
    StaySummaryDto CheckInStay(CheckInStayRequest request, ICurrentUserContext userContext);
    ClientDashboardResponse GetClientDashboard(ICurrentUserContext userContext);
}
