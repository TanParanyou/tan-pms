using TanPms.Domain.Common;

namespace TanPms.Domain.Rates;

public static class UtilityMeterCalculator
{
    public static decimal CalculateUsageUnits(
        decimal previousReading,
        decimal currentReading,
        bool isRolloverConfirmed = false,
        int meterMaxDigits = 4)
    {
        if (currentReading >= previousReading)
        {
            return decimal.Round(currentReading - previousReading, 2, MidpointRounding.AwayFromZero);
        }

        if (!isRolloverConfirmed)
        {
            throw new DomainRuleException(
                DomainErrorCodes.MeterRolloverUnconfirmed,
                $"Current meter reading ({currentReading}) is less than previous reading ({previousReading}) without rollover confirmation.");
        }

        var modulus = PowerOfTen(meterMaxDigits);
        return decimal.Round((modulus - previousReading) + currentReading, 2, MidpointRounding.AwayFromZero);
    }

    public static UtilityMeterCalculationResult Calculate(
        decimal previousReading,
        decimal currentReading,
        UtilityTariff tariff,
        bool isRolloverConfirmed = false,
        int meterMaxDigits = 4,
        int occupantCount = 1)
    {
        var usageUnits = CalculateUsageUnits(previousReading, currentReading, isRolloverConfirmed, meterMaxDigits);
        var chargeAmount = tariff.BillingMode switch
        {
            UtilityBillingMode.PerUnit => Math.Max(
                decimal.Round(usageUnits * tariff.RatePerUnit, 2, MidpointRounding.AwayFromZero),
                decimal.Round(tariff.MinimumChargeAmount, 2, MidpointRounding.AwayFromZero)),
            UtilityBillingMode.MinimumUnits => usageUnits <= tariff.IncludedUnits
                ? decimal.Round(tariff.BaseMinimumAmount, 2, MidpointRounding.AwayFromZero)
                : decimal.Round(
                    tariff.BaseMinimumAmount + ((usageUnits - tariff.IncludedUnits) * tariff.RatePerUnit),
                    2,
                    MidpointRounding.AwayFromZero),
            UtilityBillingMode.FlatRate => tariff.FlatRatePerOccupant
                ? decimal.Round(tariff.FlatRateAmount * Math.Max(occupantCount, 1), 2, MidpointRounding.AwayFromZero)
                : decimal.Round(tariff.FlatRateAmount, 2, MidpointRounding.AwayFromZero),
            _ => throw new DomainRuleException(DomainErrorCodes.ValidationFailed, "Unsupported utility billing mode.", 400)
        };

        return new UtilityMeterCalculationResult(
            PreviousReading: previousReading,
            CurrentReading: currentReading,
            UsageUnits: usageUnits,
            ChargeAmount: chargeAmount,
            UsedRollover: currentReading < previousReading);
    }

    private static decimal PowerOfTen(int digits)
    {
        if (digits <= 0)
        {
            throw new DomainRuleException(DomainErrorCodes.ValidationFailed, "MeterMaxDigits must be positive.", 400);
        }

        decimal result = 1m;
        for (int i = 0; i < digits; i++)
        {
            result *= 10m;
        }

        return result;
    }
}
