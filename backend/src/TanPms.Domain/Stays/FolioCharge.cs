using TanPms.Domain.Common;
using TanPms.Domain.Rates;

namespace TanPms.Domain.Stays;

public sealed class FolioCharge
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public required LocalizedText Description { get; init; }
    public required decimal Amount { get; init; }
    public required TaxMode TaxMode { get; init; }
}
