using TanPms.Domain.Common;

namespace TanPms.Domain.Properties;

public sealed class Building : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required string Code { get; set; }
    public required LocalizedText Name { get; set; }
    public List<Floor> Floors { get; init; } = [];
}
