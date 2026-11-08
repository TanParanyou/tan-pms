using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Billing;

public sealed record InvoiceLineRequest(
    LocalizedTextDto Description,
    decimal LineAmount,
    string TaxMode);
