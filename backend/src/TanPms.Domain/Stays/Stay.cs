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
    public string? Note { get; set; }
    public string? CancelReason { get; private set; }

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

    // Lengthening goes through ExtendStay (it re-prices the folio); this only pulls the expected check-out earlier.
    public void ShortenExpectedCheckOut(DateTimeOffset newExpectedCheckOutAt, DateTimeOffset nowUtc)
    {
        EnsureActive();
        if (newExpectedCheckOutAt <= CheckInAt || newExpectedCheckOutAt < nowUtc)
        {
            throw Invalid("ExpectedCheckOutAt must be after check-in and not in the past.");
        }

        if (ExpectedCheckOutAt is { } current && newExpectedCheckOutAt > current)
        {
            throw Invalid("Use the extend endpoint to lengthen a stay so the folio is re-priced.");
        }

        ExpectedCheckOutAt = newExpectedCheckOutAt;
    }

    public void CancelMistakenCheckIn(Folio folio, string reason)
    {
        EnsureActive();
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw Invalid("Cancel reason is required.");
        }

        if (ReservationId.HasValue)
        {
            throw Invalid("A check-in created from a reservation must be checked out, not cancelled.");
        }

        if (folio.TotalPayments != 0m || folio.Charges.Count(c => !c.IsVoided) > 1)
        {
            throw Invalid("Only a check-in with no payments and no charges beyond the initial room charge can be cancelled.");
        }

        CancelReason = reason.Trim();
        Status = StayStatus.Cancelled;
    }

    public void EnsureActive()
    {
        if (Status != StayStatus.Active)
        {
            throw Invalid($"Stay {DocumentNumber} is {Status}; an Active stay is required.");
        }
    }

    private static DomainRuleException Invalid(string message) =>
        new(DomainErrorCodes.ValidationFailed, message, httpStatus: 400);

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
