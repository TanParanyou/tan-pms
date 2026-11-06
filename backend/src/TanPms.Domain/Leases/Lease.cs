using TanPms.Domain.Common;

namespace TanPms.Domain.Leases;

public sealed class Lease : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required string DocumentNumber { get; set; }
    public required Guid UnitId { get; set; }
    public required Guid CustomerId { get; set; }
    public required DateOnly StartDate { get; set; }
    public required DateOnly EndDate { get; set; }
    public required decimal MonthlyRentAmount { get; set; }
    public required decimal SecurityDepositAmount { get; set; }
    public decimal InitialWaterMeterReading { get; set; }
    public decimal InitialElectricMeterReading { get; set; }
    public LeaseStatus Status { get; private set; } = LeaseStatus.Draft;

    public bool BlocksUnitAvailability => Status is LeaseStatus.Active or LeaseStatus.MoveOutNotice;

    public void Activate()
    {
        Status = LeaseStatus.Active;
    }

    public void GiveMoveOutNotice()
    {
        if (Status != LeaseStatus.Active)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "Only an Active lease can transition to MoveOutNotice.",
                httpStatus: 400);
        }

        Status = LeaseStatus.MoveOutNotice;
    }

    public void CompleteMoveOut()
    {
        Status = LeaseStatus.MovedOut;
    }
}
