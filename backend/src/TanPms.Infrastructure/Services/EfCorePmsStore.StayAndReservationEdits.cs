using Microsoft.EntityFrameworkCore;
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

public sealed partial class EfCorePmsStore
{
    public Result<ReservationItemDto> GetAdminReservation(Guid propertyId, Guid reservationId, DateTimeOffset? nowUtc = null)
    {
        ExpireStaleHolds(propertyId, nowUtc ?? DateTimeOffset.UtcNow);
        _dbContext.SaveChanges();
        var reservation = _dbContext.Reservations.AsNoTracking().FirstOrDefault(r => r.Id == reservationId && r.PropertyId == propertyId);
        return reservation is null
            ? Result<ReservationItemDto>.Failure(ReservationNotFound(propertyId, reservationId))
            : Result<ReservationItemDto>.Success(MapReservationItems([reservation])[0]);
    }

    public Result<ReservationItemDto> UpdateAdminReservation(
        Guid propertyId,
        Guid reservationId,
        UpdateReservationRequest request,
        DateTimeOffset? nowUtc = null)
    {
        var clockUtc = nowUtc ?? DateTimeOffset.UtcNow;
        var unitType = _dbContext.UnitTypes.AsNoTracking().FirstOrDefault(t => t.Id == request.UnitTypeId && t.PropertyId == propertyId);
        if (unitType is null)
        {
            return Result<ReservationItemDto>.Failure(new Error(DomainErrorCodes.ValidationFailed, $"UnitType '{request.UnitTypeId}' does not belong to property '{propertyId}'."));
        }

        if (request.UnitId.HasValue && !_dbContext.Units.AsNoTracking().Any(u => u.Id == request.UnitId.Value && u.UnitTypeId == unitType.Id))
        {
            return Result<ReservationItemDto>.Failure(new Error(DomainErrorCodes.ValidationFailed, $"Unit '{request.UnitId}' does not belong to UnitType '{unitType.Code}'."));
        }

        using var tx = BeginTransactionIfNeeded();
        try
        {
            LockUnitTypeRow(unitType.Id);
            ExpireStaleHolds(propertyId, clockUtc);
            var reservation = _dbContext.Reservations.FirstOrDefault(r => r.Id == reservationId && r.PropertyId == propertyId);
            if (reservation is null)
            {
                return Result<ReservationItemDto>.Failure(ReservationNotFound(propertyId, reservationId));
            }

            if (!unitType.SupportedStayModes.Contains(reservation.StayMode))
            {
                return Result<ReservationItemDto>.Failure(new Error(DomainErrorCodes.ValidationFailed, $"UnitType '{unitType.Code}' does not support StayMode '{reservation.StayMode}'."));
            }

            // Same engine as create, but this reservation's own slot does not block itself.
            var availability = EvaluateUnitTypeAvailabilityFromDb(
                propertyId,
                unitType,
                reservation.StayMode,
                request.SlotStartAt,
                request.SlotEndAt,
                clockUtc,
                FindActiveRatePlan(propertyId, unitType.Id)?.TurnaroundBufferMinutes ?? 30,
                ignoreReservationId: reservation.Id);
            if (request.UnitId.HasValue)
            {
                UnifiedAvailabilityCalculator.EnsureSpecificUnitAvailable(request.UnitId.Value, availability);
            }

            UnifiedAvailabilityCalculator.EnsureQuotaAvailable(availability);
            reservation.Reschedule(unitType.Id, request.UnitId, request.SlotStartAt, request.SlotEndAt, request.GuestCount, request.Note);
            _dbContext.SaveChanges();
            tx?.Commit();
            return Result<ReservationItemDto>.Success(MapReservationItems([reservation])[0]);
        }
        catch (DomainRuleException ex)
        {
            return Result<ReservationItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
        catch (DbUpdateException ex) when (ex.InnerException is Npgsql.PostgresException { SqlState: "23P01" })
        {
            return Result<ReservationItemDto>.Failure(new Error(DomainErrorCodes.ReservationSlotOverlap, "The new slot overlaps another booking of this unit."));
        }
    }

    public Result<ReservationItemDto> DeleteAdminReservation(Guid propertyId, Guid reservationId, DateTimeOffset? nowUtc = null)
    {
        ExpireStaleHolds(propertyId, nowUtc ?? DateTimeOffset.UtcNow);
        var reservation = _dbContext.Reservations.FirstOrDefault(r => r.Id == reservationId && r.PropertyId == propertyId);
        if (reservation is null)
        {
            return Result<ReservationItemDto>.Failure(ReservationNotFound(propertyId, reservationId));
        }

        try
        {
            reservation.EnsureCanDelete();
            var dto = MapReservationItems([reservation])[0];
            _dbContext.Reservations.Remove(reservation);
            _dbContext.SaveChanges();
            return Result<ReservationItemDto>.Success(dto);
        }
        catch (DomainRuleException ex)
        {
            return Result<ReservationItemDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
    }

    public Result<StayDetailDto> GetAdminStay(Guid propertyId, Guid stayId, bool unmaskPii = false, DateTimeOffset? nowUtc = null)
    {
        var stay = _dbContext.Stays.AsNoTracking().FirstOrDefault(s => s.Id == stayId && s.PropertyId == propertyId);
        return stay is null
            ? Result<StayDetailDto>.Failure(StayRecordMapper.StayNotFound(propertyId, stayId))
            : Result<StayDetailDto>.Success(MapStayDetailDto(stay, nowUtc ?? DateTimeOffset.UtcNow, unmaskPii));
    }

    public Result<StayDetailDto> AddAdminStayOccupant(Guid propertyId, Guid stayId, CheckInOccupantInputDto request)
    {
        if (StayRecordMapper.ValidateOccupantInput(request.FullName, request.IdentityNumber, identityRequired: true) is { } validationError)
        {
            return Result<StayDetailDto>.Failure(validationError);
        }

        return MutateActiveStay(propertyId, stayId, stay =>
        {
            var occupant = StayRecordMapper.BuildOccupant(stay.PropertyId, stay.CustomerId, stay.Id, request);
            _dbContext.Occupants.Add(occupant);
            if (occupant.IsPrimaryOccupant)
            {
                StayRecordMapper.DemoteOthers(_dbContext.Occupants.Where(o => o.StayId == stay.Id).ToList().Append(occupant), occupant.Id);
            }

            return null;
        });
    }

    public Result<StayDetailDto> UpdateAdminStayOccupant(Guid propertyId, Guid stayId, Guid occupantId, UpdateStayOccupantRequest request) =>
        StayRecordMapper.ValidateOccupantInput(request.FullName, request.IdentityNumber, identityRequired: false) is { } validationError
            ? Result<StayDetailDto>.Failure(validationError)
            : MutateActiveStay(propertyId, stayId, stay =>
                StayRecordMapper.ApplyOccupantUpdate(_dbContext.Occupants.Where(o => o.StayId == stay.Id).ToList(), occupantId, request));

    public Result<StayDetailDto> DeleteAdminStayOccupant(Guid propertyId, Guid stayId, Guid occupantId) =>
        MutateActiveStay(propertyId, stayId, stay =>
        {
            if (StayRecordMapper.CheckOccupantDelete(_dbContext.Occupants.Where(o => o.StayId == stay.Id).ToList(), occupantId, out var occupant) is { } deleteError)
            {
                return deleteError;
            }

            _dbContext.Occupants.Remove(occupant!);
            return null;
        });

    public Result<StayDetailDto> UpdateAdminStay(Guid propertyId, Guid stayId, UpdateStayRequest request, DateTimeOffset? nowUtc = null) =>
        StayRecordMapper.ValidateNote(request.Note) is { } noteError
            ? Result<StayDetailDto>.Failure(noteError)
            : MutateActiveStay(propertyId, stayId, stay =>
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
            : MutateActiveStay(propertyId, stayId, stay =>
            {
                EnsureTrackedFolio(stay).VoidCharge(chargeId, request.Reason);
                return null;
            });

    public Result<StayDetailDto> ReverseAdminFolioPayment(Guid propertyId, Guid stayId, ReverseFolioPaymentRequest request, string? cashierUserId = null) =>
        StayRecordMapper.ValidateReversal(request) is { } validationError
            ? Result<StayDetailDto>.Failure(validationError)
            : MutateActiveStay(propertyId, stayId, stay =>
            {
                EnsureTrackedFolio(stay).ReversePayment(request.Amount);
                if (request.PaymentMethod == "Cash")
                {
                    FindTrackedOpenShift(propertyId, cashierUserId)?.ReverseCashReceipt(request.Amount);
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
        using var tx = BeginTransactionIfNeeded();
        var stay = _dbContext.Stays.FirstOrDefault(s => s.Id == stayId && s.PropertyId == propertyId);
        if (stay is null)
        {
            return Result<StayDetailDto>.Failure(StayRecordMapper.StayNotFound(propertyId, stayId));
        }

        LockUnitRow(stay.UnitId);
        _dbContext.Entry(stay).Reload();
        try
        {
            stay.CancelMistakenCheckIn(EnsureTrackedFolio(stay), request.Reason);
            var ledger = _dbContext.DepositLedgers.Include(l => l.Transactions)
                .FirstOrDefault(l => l.StayId == stay.Id && l.DepositType == DepositType.KeyDeposit);
            if (ledger is { CurrentBalance: > 0m })
            {
                var existingTxIds = ledger.Transactions.Select(t => t.Id).ToHashSet();
                var property = _dbContext.Properties.AsNoTracking().First(p => p.Id == propertyId);
                ledger.RefundRemainingBalance(
                    _documentNumberService.NextDocumentNumberAsync(property.Id, property.Code, DocumentTypeCode.DEP, clockUtc).GetAwaiter().GetResult(),
                    request.Reason.Trim(),
                    FindTrackedOpenShift(propertyId, cashierUserId),
                    PaymentMethods.Cash);
                _dbContext.DepositTransactions.AddRange(ledger.Transactions.Where(t => !existingTxIds.Contains(t.Id)));
            }

            _dbContext.Units.First(u => u.Id == stay.UnitId).MarkVacantAfterCancelledCheckIn();
            _dbContext.SaveChanges();
            tx?.Commit();
            return Result<StayDetailDto>.Success(MapStayDetailDto(stay, clockUtc, unmaskPii: false));
        }
        catch (DomainRuleException ex)
        {
            return Result<StayDetailDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
    }

    private Result<StayDetailDto> MutateActiveStay(Guid propertyId, Guid stayId, Func<Stay, Error?> mutate)
    {
        var stay = _dbContext.Stays.FirstOrDefault(s => s.Id == stayId && s.PropertyId == propertyId);
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

            _dbContext.SaveChanges();
            return Result<StayDetailDto>.Success(MapStayDetailDto(stay, DateTimeOffset.UtcNow, unmaskPii: false));
        }
        catch (DomainRuleException ex)
        {
            return Result<StayDetailDto>.Failure(new Error(ex.ErrorCode, ex.Message));
        }
    }

    private static Error ReservationNotFound(Guid propertyId, Guid reservationId) =>
        new(DomainErrorCodes.ValidationFailed, $"Reservation '{reservationId}' was not found in property '{propertyId}'.");
}
