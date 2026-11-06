using TanPms.Domain.Common;

namespace TanPms.Domain.Rates;

public static class HourlyPricingCalculator
{
    public static HourlyPriceResult Calculate(int durationMinutes, HourlyRateRule rule)
    {
        if (durationMinutes < 0)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "Stay duration in minutes cannot be negative.",
                httpStatus: 400);
        }

        var baseThresholdMinutes = (rule.BasePackageHours * 60) + rule.GracePeriodMinutes;
        int extraHours = 0;
        decimal rawCharge = rule.BasePackagePrice;

        if (durationMinutes > baseThresholdMinutes)
        {
            var excessMinutes = durationMinutes - baseThresholdMinutes;
            extraHours = (excessMinutes + 59) / 60;
            rawCharge = rule.BasePackagePrice + (extraHours * rule.AdditionalHourPrice);
        }

        rawCharge = decimal.Round(rawCharge, 2, MidpointRounding.AwayFromZero);
        var cap = decimal.Round(rule.AutoCapToDailyRate, 2, MidpointRounding.AwayFromZero);
        var finalCharge = Math.Min(rawCharge, cap);

        return new HourlyPriceResult(
            DurationMinutes: durationMinutes,
            ExtraHours: extraHours,
            RawCharge: rawCharge,
            FinalHourlyRoomCharge: finalCharge,
            IsCappedToDailyRate: rawCharge > cap);
    }

    public static DateTimeOffset GetTurnaroundBlockedUntil(DateTimeOffset slotEndAt, int turnaroundBufferMinutes) =>
        slotEndAt.AddMinutes(turnaroundBufferMinutes);
}
