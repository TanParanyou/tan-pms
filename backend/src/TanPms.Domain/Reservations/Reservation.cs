using TanPms.Domain.Common;
using TanPms.Domain.Properties;

namespace TanPms.Domain.Reservations;

public sealed class Reservation : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required string DocumentNumber { get; set; }
    public required Guid CustomerId { get; set; }
    public required Guid UnitTypeId { get; set; }
    public Guid? UnitId { get; set; }
    public required StayMode StayMode { get; set; }
    public required DateTimeOffset SlotStartAt { get; set; }
    public required DateTimeOffset SlotEndAt { get; set; }
    public DateTimeOffset HoldExpiresAt { get; set; }
    public decimal DepositAmount { get; set; }
    public string? PaymentSlipFileKey { get; set; }
    public string? CancellationReason { get; private set; }
    public ReservationStatus Status { get; private set; } = ReservationStatus.Hold;

    public static Reservation CreateOnlineHold(
        Guid propertyId,
        string documentNumber,
        Guid customerId,
        Guid unitTypeId,
        StayMode stayMode,
        DateTimeOffset slotStartAt,
        DateTimeOffset slotEndAt,
        decimal depositAmount,
        DateTimeOffset nowUtc,
        int holdTtlMinutes = 15,
        Guid? unitId = null,
        Guid? id = null)
    {
        if (slotEndAt <= slotStartAt)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "Reservation SlotEndAt must be strictly after SlotStartAt.",
                httpStatus: 400);
        }

        if (depositAmount < 0m)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "Reservation DepositAmount cannot be negative.",
                httpStatus: 400);
        }

        return new Reservation
        {
            Id = id ?? Guid.NewGuid(),
            PropertyId = propertyId,
            DocumentNumber = documentNumber,
            CustomerId = customerId,
            UnitTypeId = unitTypeId,
            UnitId = unitId,
            StayMode = stayMode,
            SlotStartAt = slotStartAt,
            SlotEndAt = slotEndAt,
            DepositAmount = decimal.Round(depositAmount, 2, MidpointRounding.AwayFromZero),
            HoldExpiresAt = nowUtc.AddMinutes(holdTtlMinutes),
            Status = ReservationStatus.Hold
        };
    }

    public static Reservation CreateByAdmin(
        Guid propertyId,
        string documentNumber,
        Guid customerId,
        Guid unitTypeId,
        StayMode stayMode,
        DateTimeOffset slotStartAt,
        DateTimeOffset slotEndAt,
        decimal depositAmount,
        DateTimeOffset nowUtc,
        bool confirmImmediately,
        Guid? unitId = null,
        int holdTtlMinutes = 15,
        Guid? id = null)
    {
        var reservation = CreateOnlineHold(
            propertyId: propertyId,
            documentNumber: documentNumber,
            customerId: customerId,
            unitTypeId: unitTypeId,
            stayMode: stayMode,
            slotStartAt: slotStartAt,
            slotEndAt: slotEndAt,
            depositAmount: depositAmount,
            nowUtc: nowUtc,
            holdTtlMinutes: holdTtlMinutes,
            unitId: unitId,
            id: id);

        if (confirmImmediately)
        {
            reservation.ConfirmByAdmin();
        }

        return reservation;
    }

    public bool IsHoldExpired(DateTimeOffset nowUtc) =>
        Status == ReservationStatus.Hold && nowUtc > HoldExpiresAt;

    public bool BlocksInventory(DateTimeOffset nowUtc) =>
        Status is ReservationStatus.PendingVerification or ReservationStatus.Confirmed or ReservationStatus.CheckedIn
        || (Status == ReservationStatus.Hold && !IsHoldExpired(nowUtc));

    public DateTimeOffset GetEffectiveBlockedEndAt(int turnaroundBufferMinutes = 30) =>
        StayMode == StayMode.Hourly
            ? SlotEndAt.AddMinutes(Math.Max(0, turnaroundBufferMinutes))
            : SlotEndAt;

    public void SubmitPaymentSlip(string slipFileKey, DateTimeOffset nowUtc)
    {
        if (string.IsNullOrWhiteSpace(slipFileKey))
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "PaymentSlipFileKey cannot be empty.",
                httpStatus: 400);
        }

        if (IsHoldExpired(nowUtc) || Status == ReservationStatus.Expired)
        {
            Status = ReservationStatus.Expired;
            throw new DomainRuleException(
                DomainErrorCodes.ReservationHoldExpired,
                $"Reservation {DocumentNumber} hold expired at {HoldExpiresAt:O}.");
        }

        if (Status is not (ReservationStatus.Hold or ReservationStatus.PendingVerification))
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                $"Cannot attach slip when reservation is in {Status} status.",
                httpStatus: 400);
        }

        PaymentSlipFileKey = slipFileKey.Trim();
        Status = ReservationStatus.PendingVerification;
    }

    public void ExpireHoldIfPastDue(DateTimeOffset nowUtc)
    {
        if (IsHoldExpired(nowUtc))
        {
            Status = ReservationStatus.Expired;
        }
    }

    public void AssignUnit(Guid unitId)
    {
        if (unitId == Guid.Empty)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "UnitId cannot be empty.",
                httpStatus: 400);
        }

        if (Status is not (ReservationStatus.Hold or ReservationStatus.PendingVerification or ReservationStatus.Confirmed))
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                $"Cannot assign unit when reservation is in {Status} status.",
                httpStatus: 400);
        }

        UnitId = unitId;
    }

    public void ConfirmByAdmin()
    {
        if (Status is not (ReservationStatus.PendingVerification or ReservationStatus.Hold))
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                $"Reservation {DocumentNumber} cannot be confirmed from status {Status}.",
                httpStatus: 400);
        }

        Status = ReservationStatus.Confirmed;
    }

    public void Cancel(string reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "An audit reason is required to cancel a reservation.",
                httpStatus: 400);
        }

        if (Status is ReservationStatus.CheckedIn or ReservationStatus.Cancelled)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                $"Reservation {DocumentNumber} cannot be cancelled from status {Status}.",
                httpStatus: 400);
        }

        CancellationReason = reason.Trim();
        Status = ReservationStatus.Cancelled;
    }

    public void MarkNoShow(string reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "An audit reason is required to mark a reservation as NoShow.",
                httpStatus: 400);
        }

        if (Status is not (ReservationStatus.Confirmed or ReservationStatus.PendingVerification))
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                $"Reservation {DocumentNumber} cannot be marked NoShow from status {Status}.",
                httpStatus: 400);
        }

        CancellationReason = reason.Trim();
        Status = ReservationStatus.NoShow;
    }

    public void MarkCheckedIn(Guid assignedUnitId)
    {
        UnitId = assignedUnitId;
        Status = ReservationStatus.CheckedIn;
    }
}
