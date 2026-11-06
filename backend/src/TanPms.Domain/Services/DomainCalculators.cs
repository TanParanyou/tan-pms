using TanPms.Domain.Entities;
using TanPms.Domain.Enums;
using TanPms.Domain.Exceptions;

namespace TanPms.Domain.Services;

public sealed record HourlyRateRule(
    int BasePackageHours,
    decimal BasePackagePrice,
    decimal AdditionalHourPrice,
    int GracePeriodMinutes,
    decimal AutoCapToDailyRate,
    int TurnaroundBufferMinutes = 30);

public sealed record HourlyPriceResult(
    int DurationMinutes,
    int ExtraHours,
    decimal RawCharge,
    decimal FinalHourlyRoomCharge,
    bool IsCappedToDailyRate);

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

public sealed record UtilityTariffRule(
    UtilityBillingMode BillingMode,
    decimal RatePerUnit,
    decimal MinimumChargeAmount = 0m,
    decimal IncludedUnits = 0m,
    decimal BaseMinimumAmount = 0m,
    decimal FlatRateAmount = 0m,
    bool FlatRatePerOccupant = false);

public sealed record UtilityMeterCalculationResult(
    decimal PreviousReading,
    decimal CurrentReading,
    decimal UsageUnits,
    decimal ChargeAmount,
    bool UsedRollover);

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
        UtilityTariffRule tariff,
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

public sealed record LineTaxBreakdown(
    TaxMode TaxMode,
    decimal LineAmount,
    decimal VatRate,
    decimal SubTotal,
    decimal VatAmount,
    decimal TotalAmount);

public sealed record WithholdingTaxBreakdown(
    decimal SubTotal,
    decimal InvoiceTotal,
    decimal WhtRate,
    decimal WithholdingTaxAmount,
    decimal NetPayable);

public static class ThaiTaxCalculator
{
    public const decimal StandardThaiVatRate = 0.07m;

    public static LineTaxBreakdown CalculateLine(decimal lineAmount, TaxMode taxMode, decimal vatRate = StandardThaiVatRate)
    {
        var roundedLine = decimal.Round(lineAmount, 2, MidpointRounding.AwayFromZero);

        return taxMode switch
        {
            TaxMode.Exempt => new LineTaxBreakdown(
                TaxMode.Exempt,
                roundedLine,
                0.00m,
                roundedLine,
                0.00m,
                roundedLine),
            TaxMode.VatIncluded => BuildVatIncluded(roundedLine, vatRate),
            TaxMode.VatExcluded => BuildVatExcluded(roundedLine, vatRate),
            _ => throw new DomainRuleException(DomainErrorCodes.ValidationFailed, "Unsupported tax mode.", 400)
        };
    }

    public static WithholdingTaxBreakdown CalculateWithholdingTax(decimal subTotal, decimal invoiceTotal, decimal whtRate)
    {
        var roundedSubTotal = decimal.Round(subTotal, 2, MidpointRounding.AwayFromZero);
        var roundedTotal = decimal.Round(invoiceTotal, 2, MidpointRounding.AwayFromZero);
        var whtAmount = decimal.Round(roundedSubTotal * whtRate, 2, MidpointRounding.AwayFromZero);
        var netPayable = roundedTotal - whtAmount;

        return new WithholdingTaxBreakdown(
            SubTotal: roundedSubTotal,
            InvoiceTotal: roundedTotal,
            WhtRate: whtRate,
            WithholdingTaxAmount: whtAmount,
            NetPayable: netPayable);
    }

    private static LineTaxBreakdown BuildVatIncluded(decimal totalAmount, decimal vatRate)
    {
        var subTotal = decimal.Round(totalAmount / (1m + vatRate), 2, MidpointRounding.AwayFromZero);
        var vatAmount = totalAmount - subTotal;
        return new LineTaxBreakdown(
            TaxMode.VatIncluded,
            totalAmount,
            vatRate,
            subTotal,
            vatAmount,
            totalAmount);
    }

    private static LineTaxBreakdown BuildVatExcluded(decimal subTotal, decimal vatRate)
    {
        var vatAmount = decimal.Round(subTotal * vatRate, 2, MidpointRounding.AwayFromZero);
        var totalAmount = subTotal + vatAmount;
        return new LineTaxBreakdown(
            TaxMode.VatExcluded,
            subTotal,
            vatRate,
            subTotal,
            vatAmount,
            totalAmount);
    }
}

public sealed record CashierShiftReconciliationResult(
    decimal ExpectedDrawerCash,
    decimal ActualCashCounted,
    decimal CashVariance);

public static class CashierShiftReconciler
{
    public static void EnsureOpenShiftAvailable(CashierShift? shift)
    {
        if (shift is null || shift.Status != CashierShiftStatus.Open)
        {
            throw new DomainRuleException(
                DomainErrorCodes.ShiftNotOpen,
                "Cashier must have an Open CashierShift in the property before performing cash transactions.");
        }
    }

    public static CashierShiftReconciliationResult Reconcile(
        CashierShift shift,
        decimal actualCashCounted,
        string? varianceRemark = null)
    {
        EnsureOpenShiftAvailable(shift);

        var expectedDrawerCash = decimal.Round(
            shift.OpeningFloatCash
            + shift.CashReceiptsInShift
            + shift.CashDepositsReceivedInShift
            - shift.CashDepositsRefundedInShift,
            2,
            MidpointRounding.AwayFromZero);

        var roundedActual = decimal.Round(actualCashCounted, 2, MidpointRounding.AwayFromZero);
        var variance = roundedActual - expectedDrawerCash;

        if (variance != 0.00m && string.IsNullOrWhiteSpace(varianceRemark))
        {
            throw new DomainRuleException(
                DomainErrorCodes.ValidationFailed,
                "A variance remark is required when ActualCashCounted differs from ExpectedDrawerCash.",
                httpStatus: 400);
        }

        return new CashierShiftReconciliationResult(expectedDrawerCash, roundedActual, variance);
    }
}

public static class PiiMasker
{
    public static string MaskThaiNationalId(string rawNationalId)
    {
        if (string.IsNullOrWhiteSpace(rawNationalId))
        {
            return "x-xxxx-xxxxx-xx-x";
        }

        var digits = new string(rawNationalId.Where(char.IsDigit).ToArray());
        if (digits.Length == 13)
        {
            return $"{digits[0]}-xxxx-xxxxx-{digits.Substring(10, 2)}-{digits[12]}";
        }

        return MaskPassport(rawNationalId);
    }

    public static string MaskPassport(string rawPassport)
    {
        if (string.IsNullOrWhiteSpace(rawPassport))
        {
            return "xxxxxxx";
        }

        var cleaned = rawPassport.Trim();
        if (cleaned.Length <= 4)
        {
            return new string('x', cleaned.Length);
        }

        return $"{cleaned[..2]}xxxx{cleaned[^3..]}";
    }

    public static string MaskIdentity(string rawValue, bool isPassport = false) =>
        isPassport ? MaskPassport(rawValue) : MaskThaiNationalId(rawValue);
}

public static class DocumentNumberFormatter
{
    public static string Format(
        string propertyCode,
        DocumentTypeCode documentType,
        int year,
        int month,
        int sequenceNumber)
    {
        if (string.IsNullOrWhiteSpace(propertyCode))
        {
            throw new DomainRuleException(DomainErrorCodes.ValidationFailed, "Property code is required.", 400);
        }

        if (month is < 1 or > 12)
        {
            throw new DomainRuleException(DomainErrorCodes.ValidationFailed, "Month must be between 1 and 12.", 400);
        }

        if (sequenceNumber <= 0)
        {
            throw new DomainRuleException(DomainErrorCodes.ValidationFailed, "Sequence number must be positive.", 400);
        }

        var twoDigitYear = year % 100;
        var normalizedProp = propertyCode.Trim().ToUpperInvariant();
        return $"{normalizedProp}-{documentType}-{twoDigitYear:00}{month:00}-{sequenceNumber:0000}";
    }
}
