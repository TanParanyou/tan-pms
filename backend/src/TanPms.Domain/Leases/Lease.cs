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
        if (Status is not (LeaseStatus.Draft or LeaseStatus.PendingSignature))
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                $"Lease cannot be activated from status {Status}.",
                httpStatus: 400);
        }

        Status = LeaseStatus.Active;
    }

    public void Renew(DateOnly newEndDate, decimal? newMonthlyRentAmount)
    {
        if (Status != LeaseStatus.Active)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "Only an Active lease can be renewed.",
                httpStatus: 400);
        }

        if (newEndDate <= EndDate)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "NewEndDate must be after the current lease EndDate.",
                httpStatus: 400);
        }

        if (newMonthlyRentAmount is < 0m)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "NewMonthlyRentAmount cannot be negative.",
                httpStatus: 400);
        }

        EndDate = newEndDate;
        if (newMonthlyRentAmount.HasValue)
        {
            MonthlyRentAmount = decimal.Round(newMonthlyRentAmount.Value, 2, MidpointRounding.AwayFromZero);
        }
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
        if (Status != LeaseStatus.MoveOutNotice)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "Only a lease in MoveOutNotice can complete move-out settlement.",
                httpStatus: 400);
        }

        Status = LeaseStatus.MovedOut;
    }
}
