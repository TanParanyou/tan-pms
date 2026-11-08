using TanPms.Domain.Common;
using TanPms.Domain.Rates;

namespace TanPms.Domain.Stays;

public sealed class Folio : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required Guid StayId { get; set; }
    public List<FolioCharge> Charges { get; init; } = [];
    public decimal TotalCharges => Charges.Sum(c => c.Amount);
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
}
