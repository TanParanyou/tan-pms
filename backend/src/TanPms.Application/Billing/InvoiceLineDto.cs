using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Billing;

public sealed record InvoiceLineDto(
    Guid Id,
    LocalizedTextDto Description,
    string TaxMode,
    decimal LineAmount,
    decimal SubTotal,
    decimal VatAmount,
    decimal NetAmount);
