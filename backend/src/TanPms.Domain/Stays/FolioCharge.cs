using TanPms.Domain.Common;
using TanPms.Domain.Rates;

namespace TanPms.Domain.Stays;

public sealed class FolioCharge
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public required LocalizedText Description { get; init; }
    public required decimal Amount { get; init; }
    public required TaxMode TaxMode { get; init; }

    // TaxProfile charge category for room charges (used by RevPAR); null for minibar, repairs and manual charges.
    public string? ChargeCategoryCode { get; init; }

    public bool IsVoided { get; private set; }
    public string? VoidReason { get; private set; }

    internal void Void(string reason)
    {
        IsVoided = true;
        VoidReason = reason.Trim();
    }
}
