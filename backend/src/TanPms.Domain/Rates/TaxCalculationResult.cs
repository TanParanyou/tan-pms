namespace TanPms.Domain.Rates;

public sealed record TaxCalculationResult(
    TaxMode TaxMode,
    decimal LineAmount,
    decimal VatRate,
    decimal SubTotal,
    decimal VatAmount,
    decimal TotalAmount);
