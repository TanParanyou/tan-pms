using TanPms.Domain.Common;

namespace TanPms.Domain.Rates;

public sealed class TaxProfile : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required string ChargeCategoryCode { get; set; }
    public required LocalizedText Name { get; set; }
    public TaxMode TaxMode { get; private set; } = TaxMode.Exempt;
    public decimal VatRatePercent { get; private set; }
    public decimal DefaultWithholdingTaxPercent { get; private set; }
    public bool IsActive { get; private set; } = true;

    public void UpdateProfile(
        string chargeCategoryCode,
        LocalizedText name,
        TaxMode taxMode,
        decimal vatRatePercent,
        decimal defaultWithholdingTaxPercent,
        bool isActive)
    {
        if (string.IsNullOrWhiteSpace(chargeCategoryCode))
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "ChargeCategoryCode cannot be empty.",
                httpStatus: 400);
        }

        if (taxMode == TaxMode.Exempt && vatRatePercent != 0m)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "Exempt TaxProfile must have VatRatePercent equal to 0.",
                httpStatus: 400);
        }

        if (taxMode != TaxMode.Exempt && (vatRatePercent <= 0m || vatRatePercent > 100m))
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "VatIncluded and VatExcluded TaxProfiles must specify a positive VatRatePercent (<= 100).",
                httpStatus: 400);
        }

        if (defaultWithholdingTaxPercent < 0m || defaultWithholdingTaxPercent > 100m)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "DefaultWithholdingTaxPercent must be between 0 and 100.",
                httpStatus: 400);
        }

        ChargeCategoryCode = chargeCategoryCode.Trim().ToUpperInvariant();
        Name = name;
        TaxMode = taxMode;
        VatRatePercent = decimal.Round(vatRatePercent, 2, MidpointRounding.AwayFromZero);
        DefaultWithholdingTaxPercent = decimal.Round(defaultWithholdingTaxPercent, 2, MidpointRounding.AwayFromZero);
        IsActive = isActive;
    }

    public decimal GetDecimalVatRate() => VatRatePercent / 100m;

    public decimal GetDecimalWithholdingRate() => DefaultWithholdingTaxPercent / 100m;
}
