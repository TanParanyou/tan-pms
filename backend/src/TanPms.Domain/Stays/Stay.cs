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
