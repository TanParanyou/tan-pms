using TanPms.Domain.Common;

namespace TanPms.Domain.Properties;

public sealed class Floor : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required Guid BuildingId { get; set; }
    public required int FloorNumber { get; set; }
    public required LocalizedText Name { get; set; }
    public List<Unit> Units { get; init; } = [];
}
