using TanPms.Domain.Common;
using TanPms.Domain.Rates;

namespace TanPms.Domain.Billing;

public sealed class InvoiceLine
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public required LocalizedText Description { get; init; }
    public required TaxMode TaxMode { get; init; }
    public required decimal LineAmount { get; init; }
    public required decimal VatRate { get; init; }
    public required decimal SubTotal { get; init; }
    public required decimal VatAmount { get; init; }
    public required decimal NetAmount { get; init; }

    // TaxProfile charge category for lines the batch run generates; null for manually added lines.
    public string? ChargeCategoryCode { get; init; }
}
