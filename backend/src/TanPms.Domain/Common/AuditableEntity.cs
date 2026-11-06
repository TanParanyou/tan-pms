namespace TanPms.Domain.Common;

public abstract class AuditableEntity
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public string CreatedBy { get; set; } = "system";
    public DateTimeOffset? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }
    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public string? DeletedBy { get; set; }

    public void MarkDeleted(string deletedBy, DateTimeOffset? deletedAt = null)
    {
        IsDeleted = true;
        DeletedBy = deletedBy;
        DeletedAt = deletedAt ?? DateTimeOffset.UtcNow;
    }
}

public sealed class AuditEvent : AuditableEntity
{
    public required Guid PropertyId { get; init; }
    public required string ActionKey { get; init; }
    public required Guid EntityId { get; init; }
    public required string Reason { get; init; }
    public string? BeforeStateJson { get; init; }
    public string? AfterStateJson { get; init; }
}
