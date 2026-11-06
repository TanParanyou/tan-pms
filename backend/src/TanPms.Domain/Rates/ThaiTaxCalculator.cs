using TanPms.Domain.Common;

namespace TanPms.Domain.Rates;

public static class ThaiTaxCalculator
{
    public const decimal StandardThaiVatRate = 0.07m;

    public static TaxCalculationResult CalculateLine(decimal lineAmount, TaxMode taxMode, decimal vatRate = StandardThaiVatRate)
    {
        var roundedLine = decimal.Round(lineAmount, 2, MidpointRounding.AwayFromZero);

        return taxMode switch
        {
            TaxMode.Exempt => new TaxCalculationResult(
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

    private static TaxCalculationResult BuildVatIncluded(decimal totalAmount, decimal vatRate)
    {
        var subTotal = decimal.Round(totalAmount / (1m + vatRate), 2, MidpointRounding.AwayFromZero);
        var vatAmount = totalAmount - subTotal;
        return new TaxCalculationResult(
            TaxMode.VatIncluded,
            totalAmount,
            vatRate,
            subTotal,
            vatAmount,
            totalAmount);
    }

    private static TaxCalculationResult BuildVatExcluded(decimal subTotal, decimal vatRate)
    {
        var vatAmount = decimal.Round(subTotal * vatRate, 2, MidpointRounding.AwayFromZero);
        var totalAmount = subTotal + vatAmount;
        return new TaxCalculationResult(
            TaxMode.VatExcluded,
            subTotal,
            vatRate,
            subTotal,
            vatAmount,
            totalAmount);
    }
}
