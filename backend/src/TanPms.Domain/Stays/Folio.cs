using TanPms.Domain.Common;
using TanPms.Domain.Rates;

namespace TanPms.Domain.Stays;

public sealed class Folio : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required Guid StayId { get; set; }
    public List<FolioCharge> Charges { get; init; } = [];
    public decimal TotalCharges => Charges.Where(c => !c.IsVoided).Sum(c => c.Amount);
    public decimal TotalPayments { get; private set; }
    public decimal BalanceDue => TotalCharges - TotalPayments;

    public void AddCharge(LocalizedText description, decimal amount, TaxMode taxMode = TaxMode.VatIncluded, string? chargeCategoryCode = null)
    {
        Charges.Add(new FolioCharge
        {
            Description = description,
            Amount = decimal.Round(amount, 2, MidpointRounding.AwayFromZero),
            TaxMode = taxMode,
            ChargeCategoryCode = chargeCategoryCode
        });
    }

    public void AddCharge(string thaiDescription, decimal amount, TaxMode taxMode = TaxMode.VatIncluded, string? englishDescription = null, string? chargeCategoryCode = null) =>
        AddCharge(LocalizedText.Create(thaiDescription, englishDescription), amount, taxMode, chargeCategoryCode);

    public void RecordPayment(decimal amount)
    {
        TotalPayments += decimal.Round(amount, 2, MidpointRounding.AwayFromZero);
    }

    // A charge already covered by payments cannot be voided; the payment must be reversed first.
    public FolioCharge VoidCharge(Guid chargeId, string reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new DomainRuleException(DomainErrorCodes.ValidationFailed, "Void reason is required.", httpStatus: 400);
        }

        var charge = Charges.FirstOrDefault(c => c.Id == chargeId && !c.IsVoided)
            ?? throw new DomainRuleException(DomainErrorCodes.ValidationFailed, $"Folio charge '{chargeId}' was not found or is already voided.", httpStatus: 400);
        if (TotalCharges - charge.Amount < TotalPayments)
        {
            throw new DomainRuleException(
                DomainErrorCodes.StayFolioUnsettled,
                "Charge is already covered by payments; reverse the payment before voiding the charge.");
        }

        charge.Void(reason);
        return charge;
    }

    public void ReversePayment(decimal amount)
    {
        var rounded = decimal.Round(amount, 2, MidpointRounding.AwayFromZero);
        if (rounded <= 0m || rounded > TotalPayments)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                $"Reversal amount must be between 0.01 and the payments received ({TotalPayments:0.00}).",
                httpStatus: 400);
        }

        TotalPayments -= rounded;
    }
}
