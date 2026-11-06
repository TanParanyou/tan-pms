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
        Guid? unitId = null)
    {
        return new Reservation
        {
            PropertyId = propertyId,
            DocumentNumber = documentNumber,
            CustomerId = customerId,
            UnitTypeId = unitTypeId,
            UnitId = unitId,
            StayMode = stayMode,
            SlotStartAt = slotStartAt,
            SlotEndAt = slotEndAt,
            DepositAmount = depositAmount,
            HoldExpiresAt = nowUtc.AddMinutes(holdTtlMinutes),
            Status = ReservationStatus.Hold
        };
    }

    public bool IsHoldExpired(DateTimeOffset nowUtc) =>
        Status == ReservationStatus.Hold && nowUtc > HoldExpiresAt;

    public void SubmitPaymentSlip(string slipFileKey, DateTimeOffset nowUtc)
    {
        if (IsHoldExpired(nowUtc) || Status == ReservationStatus.Expired)
        {
            Status = ReservationStatus.Expired;
            throw new DomainRuleException(
                DomainErrorCodes.ReservationHoldExpired,
                $"Reservation {DocumentNumber} hold expired at {HoldExpiresAt:O}.");
        }

        PaymentSlipFileKey = slipFileKey;
        Status = ReservationStatus.PendingVerification;
    }

    public void ExpireHoldIfPastDue(DateTimeOffset nowUtc)
    {
        if (IsHoldExpired(nowUtc))
        {
            Status = ReservationStatus.Expired;
        }
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

    public void MarkCheckedIn(Guid assignedUnitId)
    {
        UnitId = assignedUnitId;
        Status = ReservationStatus.CheckedIn;
    }
}
