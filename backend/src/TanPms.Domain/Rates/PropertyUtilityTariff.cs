using TanPms.Domain.Common;

namespace TanPms.Domain.Rates;

public sealed class PropertyUtilityTariff : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required UtilityType UtilityType { get; set; }
    public required LocalizedText Name { get; set; }
    public UtilityBillingMode BillingMode { get; private set; } = UtilityBillingMode.PerUnit;
    public decimal RatePerUnit { get; private set; }
    public decimal MinimumChargeAmount { get; private set; }
    public decimal IncludedUnits { get; private set; }
    public decimal BaseMinimumAmount { get; private set; }
    public decimal FlatRateAmount { get; private set; }
    public bool FlatRatePerOccupant { get; private set; }
    public int MeterMaxDigits { get; private set; } = 4;

    public void UpdateTariff(
        LocalizedText name,
        UtilityBillingMode billingMode,
        decimal ratePerUnit,
        decimal minimumChargeAmount,
        decimal includedUnits,
        decimal baseMinimumAmount,
        decimal flatRateAmount,
        bool flatRatePerOccupant,
        int meterMaxDigits)
    {
        if (ratePerUnit < 0m
            || minimumChargeAmount < 0m
            || includedUnits < 0m
            || baseMinimumAmount < 0m
            || flatRateAmount < 0m)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "Utility tariff amounts and unit thresholds cannot be negative.",
                httpStatus: 400);
        }

        if (meterMaxDigits < 1 || meterMaxDigits > 8)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "MeterMaxDigits must be between 1 and 8.",
                httpStatus: 400);
        }

        Name = name;
        BillingMode = billingMode;
        RatePerUnit = decimal.Round(ratePerUnit, 2, MidpointRounding.AwayFromZero);
        MinimumChargeAmount = decimal.Round(minimumChargeAmount, 2, MidpointRounding.AwayFromZero);
        IncludedUnits = decimal.Round(includedUnits, 2, MidpointRounding.AwayFromZero);
        BaseMinimumAmount = decimal.Round(baseMinimumAmount, 2, MidpointRounding.AwayFromZero);
        FlatRateAmount = decimal.Round(flatRateAmount, 2, MidpointRounding.AwayFromZero);
        FlatRatePerOccupant = flatRatePerOccupant;
        MeterMaxDigits = meterMaxDigits;
    }

    public UtilityTariff ToUtilityTariff() =>
        new(
            BillingMode: BillingMode,
            RatePerUnit: RatePerUnit,
            MinimumChargeAmount: MinimumChargeAmount,
            IncludedUnits: IncludedUnits,
            BaseMinimumAmount: BaseMinimumAmount,
            FlatRateAmount: FlatRateAmount,
            FlatRatePerOccupant: FlatRatePerOccupant);
}
