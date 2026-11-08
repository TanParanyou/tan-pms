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

    // Only monthly rent (applies to invoices drafted from now on) and move-in meter readings are editable on an Active lease.
    public void UpdateTerms(decimal? monthlyRentAmount, decimal? initialWaterMeterReading, decimal? initialElectricMeterReading)
    {
        if (Status != LeaseStatus.Active)
        {
            throw Invalid($"Lease {DocumentNumber} must be Active to edit its terms (current: {Status}).");
        }

        if (monthlyRentAmount is < 0m || initialWaterMeterReading is < 0m || initialElectricMeterReading is < 0m)
        {
            throw Invalid("Monthly rent and initial meter readings cannot be negative.");
        }

        if (monthlyRentAmount.HasValue)
        {
            MonthlyRentAmount = decimal.Round(monthlyRentAmount.Value, 2, MidpointRounding.AwayFromZero);
        }

        InitialWaterMeterReading = initialWaterMeterReading ?? InitialWaterMeterReading;
        InitialElectricMeterReading = initialElectricMeterReading ?? InitialElectricMeterReading;
    }

    // Active -> Cancelled; callers must first prove the lease has no billed (non-Draft, non-Voided) invoice.
    public void Cancel()
    {
        if (Status != LeaseStatus.Active)
        {
            throw Invalid($"Only an Active lease can be cancelled (current: {Status}).");
        }

        Status = LeaseStatus.Cancelled;
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

    private static DomainRuleException Invalid(string message) =>
        new(DomainErrorCodes.ValidationFailed, message, httpStatus: 400);
}
