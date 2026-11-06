using TanPms.Domain.Common;

namespace TanPms.Domain.Notifications;

public sealed class NotificationMessage : AuditableEntity
{
    public required Guid PropertyId { get; set; }
    public required Guid CustomerId { get; set; }
    public required NotificationChannel Channel { get; set; }
    public required string TemplateKey { get; set; }
    public required LocalizedText Title { get; set; }
    public required LocalizedText Body { get; set; }
    public bool IsRead { get; private set; }
    public DateTimeOffset SentAtUtc { get; set; } = DateTimeOffset.UtcNow;

    public void MarkAsRead()
    {
        IsRead = true;
    }
}
