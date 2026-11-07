using TanPms.Domain.Billing;
using TanPms.Domain.Common;
using TanPms.Domain.Leases;
using TanPms.Domain.Meters;
using TanPms.Domain.Rates;

namespace TanPms.Application.Meters;

// Pure meter rules shared by both persistence providers.
public static class MeterReadingRules
{
    public const decimal AnomalyMinimumUnits = 500m;
    public const decimal AnomalyPreviousUsageMultiplier = 3m;

    // An issued (or later) invoice freezes the period's readings; Draft and Voided do not.
    public static bool LocksPeriod(Invoice invoice) =>
        invoice.Status is not (InvoiceStatus.Draft or InvoiceStatus.Voided);

    public static bool IsLeaseBillableInPeriod(Lease lease, DateOnly periodStart, DateOnly periodEnd) =>
        lease.BlocksUnitAvailability && lease.StartDate <= periodEnd && lease.EndDate >= periodStart;

    // Last reading inside the lease before the period; falls back to the lease move-in reading.
    public static (decimal PreviousReading, decimal? PreviousUsageUnits) ResolvePrevious(
        Lease lease,
        UtilityType utilityType,
        string period,
        IEnumerable<MeterReading> unitReadings)
    {
        var leaseStartPeriod = BillingPeriod.Format(new DateOnly(lease.StartDate.Year, lease.StartDate.Month, 1));
        var last = unitReadings
            .Where(r => r.UtilityType == utilityType
                        && string.CompareOrdinal(r.BillingPeriodYearMonth, period) < 0
                        && string.CompareOrdinal(r.BillingPeriodYearMonth, leaseStartPeriod) >= 0)
            .OrderByDescending(r => r.BillingPeriodYearMonth, StringComparer.Ordinal)
            .FirstOrDefault();
        if (last is not null)
        {
            return (last.CurrentReading, last.UsageUnits);
        }

        return (utilityType == UtilityType.Water ? lease.InitialWaterMeterReading : lease.InitialElectricMeterReading, null);
    }

    public static bool IsUsageAnomalous(decimal usageUnits, decimal? previousUsageUnits) =>
        usageUnits > Math.Max(AnomalyMinimumUnits, (previousUsageUnits ?? 0m) * AnomalyPreviousUsageMultiplier);

    public static UtilityReadingResultDto? Evaluate(
        UtilityType utilityType,
        decimal previousReading,
        decimal? previousUsageUnits,
        decimal currentReading,
        bool rolloverConfirmed,
        PropertyUtilityTariff? tariff,
        int occupantCount,
        List<MeterReadingIssueDto> errors,
        List<MeterReadingIssueDto> warnings)
    {
        var utility = utilityType.ToString();
        if (currentReading < 0m)
        {
            errors.Add(new MeterReadingIssueDto(MeterReadingIssueCodes.NegativeReading, utility));
            return null;
        }

        if (tariff is null)
        {
            errors.Add(new MeterReadingIssueDto(MeterReadingIssueCodes.TariffMissing, utility));
            return null;
        }

        try
        {
            var result = UtilityMeterCalculator.Calculate(
                previousReading,
                currentReading,
                tariff.ToUtilityTariff(),
                rolloverConfirmed,
                tariff.MeterMaxDigits,
                occupantCount);
            if (IsUsageAnomalous(result.UsageUnits, previousUsageUnits))
            {
                warnings.Add(new MeterReadingIssueDto(MeterReadingIssueCodes.UsageAnomaly, utility));
            }

            return new UtilityReadingResultDto(
                result.PreviousReading,
                result.CurrentReading,
                result.UsageUnits,
                result.ChargeAmount,
                result.UsedRollover);
        }
        catch (DomainRuleException ex)
        {
            errors.Add(new MeterReadingIssueDto(ex.ErrorCode, utility));
            return null;
        }
    }
}
