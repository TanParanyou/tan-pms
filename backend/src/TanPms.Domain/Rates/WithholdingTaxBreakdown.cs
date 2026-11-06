namespace TanPms.Domain.Rates;

public sealed record WithholdingTaxBreakdown(
    decimal SubTotal,
    decimal InvoiceTotal,
    decimal WhtRate,
    decimal WithholdingTaxAmount,
    decimal NetPayable);
