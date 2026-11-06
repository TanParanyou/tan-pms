namespace TanPms.Domain.Common;

public sealed class AuditEvent : AuditableEntity
{
    public required Guid PropertyId { get; init; }
    public required string ActionKey { get; init; }
    public required Guid EntityId { get; init; }
    public required string Reason { get; init; }
    public string? BeforeStateJson { get; init; }
    public string? AfterStateJson { get; init; }
}
