namespace TanPms.Application.Rates;

public sealed record TaxSimulationQuoteDto(
    string TaxMode,
    decimal VatRatePercent,
    decimal SubTotal,
    decimal VatAmount,
    decimal InvoiceTotal,
    decimal WithholdingTaxPercent,
    decimal WithholdingTaxAmount,
    decimal NetPayable);
