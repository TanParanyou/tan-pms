using TanPms.Domain.Cashier;
using TanPms.Domain.Common;
using TanPms.Domain.Properties;

namespace TanPms.Domain.Stays;

public sealed class Stay : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required string DocumentNumber { get; set; }
    public required Guid UnitId { get; set; }
    public required Guid CustomerId { get; set; }
    public Guid? ReservationId { get; set; }
    public required StayMode StayMode { get; set; }
    public required DateTimeOffset CheckInAt { get; set; }
    public DateTimeOffset? ExpectedCheckOutAt { get; set; }
    public DateTimeOffset? CheckOutAt { get; private set; }
    public decimal KeyDepositAmount { get; set; }
    public StayStatus Status { get; private set; } = StayStatus.Active;

    public int? GetRemainingMinutes(DateTimeOffset nowUtc)
    {
        if (Status != StayStatus.Active || !ExpectedCheckOutAt.HasValue)
        {
            return null;
        }

        return (int)Math.Floor((ExpectedCheckOutAt.Value - nowUtc).TotalMinutes);
    }

    public bool IsOvertime(DateTimeOffset nowUtc, int gracePeriodMinutes = 0) =>
        Status == StayStatus.Active
        && ExpectedCheckOutAt.HasValue
        && nowUtc > ExpectedCheckOutAt.Value.AddMinutes(Math.Max(0, gracePeriodMinutes));

    public void ExtendStay(int additionalHours)
    {
        if (Status != StayStatus.Active)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                $"Cannot extend stay {DocumentNumber} when status is {Status}.",
                httpStatus: 400);
        }

        if (additionalHours <= 0)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "AdditionalHours must be greater than zero.",
                httpStatus: 400);
        }

        var baseline = ExpectedCheckOutAt ?? CheckInAt.AddHours(3);
        ExpectedCheckOutAt = baseline.AddHours(additionalHours);
    }

    public void CompleteCheckOut(Folio folio, DepositLedger? keyDepositLedger, DateTimeOffset checkOutAt)
    {
        if (folio.BalanceDue != 0.00m)
        {
            throw new DomainRuleException(
                DomainErrorCodes.StayFolioUnsettled,
                $"Stay {DocumentNumber} cannot be checked out while Folio balance due is {folio.BalanceDue:0.00}.");
        }

        if (KeyDepositAmount > 0m && (keyDepositLedger is null || keyDepositLedger.CurrentBalance != 0.00m))
        {
            throw new DomainRuleException(
                DomainErrorCodes.StayFolioUnsettled,
                $"Stay {DocumentNumber} cannot be checked out while key deposit balance is unsettled.");
        }

        CheckOutAt = checkOutAt;
        Status = StayStatus.CheckedOut;
    }
}
