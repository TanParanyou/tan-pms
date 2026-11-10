using TanPms.Application.Cashier;
using TanPms.Application.Common.Contracts;
using TanPms.Application.Common.Results;
using TanPms.Application.Reservations;
using TanPms.Application.Stays;
using TanPms.Domain.Cashier;
using TanPms.Domain.Common;
using TanPms.Domain.DocumentNumbering;
using TanPms.Domain.Reservations;
using TanPms.Domain.Stays;

namespace TanPms.Infrastructure.Services;

public sealed partial class InMemoryOperationalService
{
    public Result<ReservationItemDto> GetAdminReservation(Guid propertyId, Guid reservationId, DateTimeOffset? nowUtc = null)
    {
        lock (_syncRoot)
        {
            ExpireStaleHoldsLocked(nowUtc ?? DateTimeOffset.UtcNow);
            var reservation = _reservations.FirstOrDefault(r => r.Id == reservationId && r.PropertyId == propertyId);
            return reservation is null
                ? Result<ReservationItemDto>.Failure(ReservationNotFound(propertyId, reservationId))
                : Result<ReservationItemDto>.Success(MapReservationItemDtoLocked(reservation));
        }
    }

    public Result<ReservationItemDto> UpdateAdminReservation(
        Guid propertyId,
        Guid reservationId,
        UpdateReservationRequest request,
        DateTimeOffset? nowUtc = null)
    {
        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;
        lock (_syncRoot)
        {
            if (!_unitTypes.TryGetValue(request.UnitTypeId, out var unitType) || unitType.PropertyId != propertyId)
            {
                return Result<ReservationItemDto>.Failure(new Error(DomainErrorCodes.ValidationFailed, $"UnitType '{request.UnitTypeId}' does not belong to property '{propertyId}'."));
            }

            if (request.UnitId.HasValue && (!_units.TryGetValue(request.UnitId.Value, out var unit) || unit.UnitTypeId != unitType.Id))
            {
                return Result<ReservationItemDto>.Failure(new Error(DomainErrorCodes.ValidationFailed, $"Unit '{request.UnitId}' does not belong to UnitType '{unitType.Code}'."));
            }

            ExpireStaleHoldsLocked(clockUtc);
            var reservation = _reservations.FirstOrDefault(r => r.Id == reservationId && r.PropertyId == propertyId);
            if (reservation is null)
            {
                return Result<ReservationItemDto>.Failure(ReservationNotFound(propertyId, reservationId));
            }

            if (!unitType.SupportedStayModes.Contains(reservation.StayMode))
            {
                return Result<ReservationItemDto>.Failure(new Error(DomainErrorCodes.ValidationFailed, $"UnitType '{unitType.Code}' does not support StayMode '{reservation.StayMode}'."));
            }

            try
            {
                var availability = UnifiedAvailabilityCalculator.EvaluateUnitTypeAvailability(
                    unitType: unitType,
                    unitsOfUnitType: _units.Values.Where(u => u.PropertyId == propertyId && u.UnitTypeId == unitType.Id),
                    propertyLeases: _leases,
                    propertyStays: _stays,
                    propertyReservations: _reservations,
                    requestedStayMode: reservation.StayMode,
                    slotStartAt: request.SlotStartAt,
                    slotEndAt: request.SlotEndAt,
                    nowUtc: clockUtc,
                    turnaroundBufferMinutes: FindActiveRatePlanLocked(propertyId, unitType.Id)?.TurnaroundBufferMinutes ?? 30,
                    ignoreReservationId: reservation.Id);
                if (request.UnitId.HasValue)
                {
                    UnifiedAvailabilityCalculator.EnsureSpecificUnitAvailable(request.UnitId.Value, availability);
                }

                UnifiedAvailabilityCalculator.EnsureQuotaAvailable(availability);
                reservation.Reschedule(unitType.Id, request.UnitId, request.SlotStartAt, request.SlotEndAt, request.GuestCount, request.Note);
                Touch(reservation);
                return Result<ReservationItemDto>.Success(MapReservationItemDtoLocked(reservation));
            }
            catch (DomainRuleException ex)
            {
                return Result<ReservationItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
        }
    }

    public Result<ReservationItemDto> DeleteAdminReservation(Guid propertyId, Guid reservationId, DateTimeOffset? nowUtc = null)
    {
        lock (_syncRoot)
        {
            ExpireStaleHoldsLocked(nowUtc ?? DateTimeOffset.UtcNow);
            var reservation = _reservations.FirstOrDefault(r => r.Id == reservationId && r.PropertyId == propertyId);
            if (reservation is null)
            {
                return Result<ReservationItemDto>.Failure(ReservationNotFound(propertyId, reservationId));
            }

            try
            {
                reservation.EnsureCanDelete();
                var dto = MapReservationItemDtoLocked(reservation);
                _reservations.Remove(reservation);
                return Result<ReservationItemDto>.Success(dto);
            }
            catch (DomainRuleException ex)
            {
                return Result<ReservationItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
        }
    }

    public Result<StayDetailDto> GetAdminStay(Guid propertyId, Guid stayId, bool unmaskPii = false, DateTimeOffset? nowUtc = null)
    {
        lock (_syncRoot)
        {
            var stay = _stays.FirstOrDefault(s => s.Id == stayId && s.PropertyId == propertyId);
            return stay is null
                ? Result<StayDetailDto>.Failure(StayRecordMapper.StayNotFound(propertyId, stayId))
                : Result<StayDetailDto>.Success(MapStayDetailDtoLocked(stay, nowUtc ?? DateTimeOffset.UtcNow, unmaskPii));
        }
    }

    public Result<StayDetailDto> AddAdminStayOccupant(Guid propertyId, Guid stayId, CheckInOccupantInputDto request) =>
        StayRecordMapper.ValidateOccupantInput(request.FullName, request.IdentityNumber, identityRequired: true) is { } validationError
            ? Result<StayDetailDto>.Failure(validationError)
            : MutateActiveStayLocked(propertyId, stayId, stay =>
            {
                var occupant = StayRecordMapper.BuildOccupant(stay.PropertyId, stay.CustomerId, stay.Id, request);
                _occupants.Add(occupant);
                if (occupant.IsPrimaryOccupant)
                {
                    StayRecordMapper.DemoteOthers(_occupants.Where(o => o.StayId == stay.Id), occupant.Id);
                }

                return null;
            });

    public Result<StayDetailDto> UpdateAdminStayOccupant(Guid propertyId, Guid stayId, Guid occupantId, UpdateStayOccupantRequest request) =>
        StayRecordMapper.ValidateOccupantInput(request.FullName, request.IdentityNumber, identityRequired: false) is { } validationError
            ? Result<StayDetailDto>.Failure(validationError)
            : MutateActiveStayLocked(propertyId, stayId, stay =>
                StayRecordMapper.ApplyOccupantUpdate(_occupants.Where(o => o.StayId == stay.Id).ToList(), occupantId, request));

    public Result<StayDetailDto> DeleteAdminStayOccupant(Guid propertyId, Guid stayId, Guid occupantId) =>
        MutateActiveStayLocked(propertyId, stayId, stay =>
        {
            if (StayRecordMapper.CheckOccupantDelete(_occupants.Where(o => o.StayId == stay.Id).ToList(), occupantId, out var occupant) is { } deleteError)
            {
                return deleteError;
            }

            _occupants.Remove(occupant!);
            return null;
        });

    public Result<StayDetailDto> UpdateAdminStay(Guid propertyId, Guid stayId, UpdateStayRequest request, DateTimeOffset? nowUtc = null) =>
        StayRecordMapper.ValidateNote(request.Note) is { } noteError
            ? Result<StayDetailDto>.Failure(noteError)
            : MutateActiveStayLocked(propertyId, stayId, stay =>
            {
                if (request.ExpectedCheckOutAt is { } expected)
                {
                    stay.ShortenExpectedCheckOut(expected, nowUtc ?? DateTimeOffset.UtcNow);
                }

                stay.Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
                return null;
            });

    public Result<StayDetailDto> VoidAdminFolioCharge(Guid propertyId, Guid stayId, Guid chargeId, ReasonRequest request) =>
        request.Validate() is { } reasonError
            ? Result<StayDetailDto>.Failure(reasonError)
            : MutateActiveStayLocked(propertyId, stayId, stay =>
            {
                EnsureFolioLocked(stay).VoidCharge(chargeId, request.Reason);
                Touch(EnsureFolioLocked(stay));
                return null;
            });

    public Result<StayDetailDto> ReverseAdminFolioPayment(Guid propertyId, Guid stayId, ReverseFolioPaymentRequest request, string? cashierUserId = null) =>
        StayRecordMapper.ValidateReversal(request) is { } validationError
            ? Result<StayDetailDto>.Failure(validationError)
            : MutateActiveStayLocked(propertyId, stayId, stay =>
            {
                EnsureFolioLocked(stay).ReversePayment(request.Amount);
                if (request.PaymentMethod == "Cash")
                {
                    FindOpenShiftForCashLocked(propertyId, cashierUserId)?.ReverseCashReceipt(request.Amount);
                }

                return null;
            });

    public Result<StayDetailDto> CancelAdminStay(Guid propertyId, Guid stayId, ReasonRequest request, string? cashierUserId = null, DateTimeOffset? nowUtc = null)
    {
        if (request.Validate() is { } reasonError)
        {
            return Result<StayDetailDto>.Failure(reasonError);
        }

        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;
        lock (_syncRoot)
        {
            var stay = _stays.FirstOrDefault(s => s.Id == stayId && s.PropertyId == propertyId);
            if (stay is null)
            {
                return Result<StayDetailDto>.Failure(StayRecordMapper.StayNotFound(propertyId, stayId));
            }

            try
            {
                stay.CancelMistakenCheckIn(EnsureFolioLocked(stay), request.Reason);
                Touch(stay, clockUtc);
                var ledger = _depositLedgers.FirstOrDefault(l => l.StayId == stay.Id && l.DepositType == DepositType.KeyDeposit);
                if (ledger is { CurrentBalance: > 0m })
                {
                    var property = _properties[propertyId];
                    ledger.RefundRemainingBalance(
                        NextDocumentNumberAsync(property.Id, property.Code, DocumentTypeCode.DEP, clockUtc).GetAwaiter().GetResult(),
                        request.Reason.Trim(),
                        FindOpenShiftForCashLocked(propertyId, cashierUserId),
                        PaymentMethods.Cash);
                }

                _units[stay.UnitId].MarkVacantAfterCancelledCheckIn();
                return Result<StayDetailDto>.Success(MapStayDetailDtoLocked(stay, clockUtc, unmaskPii: false));
            }
            catch (DomainRuleException ex)
            {
                return Result<StayDetailDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
        }
    }

    private Result<StayDetailDto> MutateActiveStayLocked(Guid propertyId, Guid stayId, Func<Stay, Error?> mutate)
    {
        lock (_syncRoot)
        {
            var stay = _stays.FirstOrDefault(s => s.Id == stayId && s.PropertyId == propertyId);
            if (stay is null)
            {
                return Result<StayDetailDto>.Failure(StayRecordMapper.StayNotFound(propertyId, stayId));
            }

            try
            {
                stay.EnsureActive();
                if (mutate(stay) is { } error)
                {
                    return Result<StayDetailDto>.Failure(error);
                }

                Touch(stay);
                return Result<StayDetailDto>.Success(MapStayDetailDtoLocked(stay, DateTimeOffset.UtcNow, unmaskPii: false));
            }
            catch (DomainRuleException ex)
            {
                return Result<StayDetailDto>.Failure(new Error(ex.ErrorCode, ex.Message));
            }
        }
    }

    private static Error ReservationNotFound(Guid propertyId, Guid reservationId) =>
        new(DomainErrorCodes.ValidationFailed, $"Reservation '{reservationId}' was not found in property '{propertyId}'.");
}
