using TanPms.Domain.Common;

namespace TanPms.Domain.Properties;

public sealed class UnitAsset : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required Guid UnitId { get; set; }
    public required string AssetCode { get; set; }
    public required LocalizedText Name { get; set; }
    public decimal ReplacementCostAmount { get; set; }
}
