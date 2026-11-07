using TanPms.Application.Common.Results;

namespace TanPms.Application.Reservations;

public interface IReservationStore
{
    Result<AvailabilitySearchResponse> SearchAvailability(
        Guid propertyId,
        string stayMode,
        DateTimeOffset slotStartAt,
        DateTimeOffset slotEndAt,
        DateTimeOffset? nowUtc = null);

    Result<ReservationListResponse> GetAdminReservations(
        Guid propertyId,
        string? status,
        string? stayMode,
        DateTimeOffset? nowUtc = null);

    Result<ReservationItemDto> CreateAdminReservation(
        Guid propertyId,
        CreateAdminReservationRequest request,
        DateTimeOffset? nowUtc = null);

    Result<ReservationItemDto> AssignReservationUnit(
        Guid propertyId,
        Guid reservationId,
        Guid unitId,
        DateTimeOffset? nowUtc = null);

    Result<ReservationItemDto> ConfirmReservation(
        Guid propertyId,
        Guid reservationId,
        DateTimeOffset? nowUtc = null);

    Result<ReservationItemDto> CancelReservation(
        Guid propertyId,
        Guid reservationId,
        CancelReservationRequest request,
        DateTimeOffset? nowUtc = null);

    Result<ReservationListResponse> GetClientReservations(
        Guid customerId,
        DateTimeOffset? nowUtc = null);

    Result<ReservationItemDto> CreateClientHoldReservation(
        Guid customerId,
        CreateClientHoldReservationRequest request,
        DateTimeOffset? nowUtc = null);

    Result<ReservationItemDto> SubmitClientReservationSlip(
        Guid customerId,
        Guid reservationId,
        SubmitReservationSlipRequest request,
        DateTimeOffset? nowUtc = null);
}
