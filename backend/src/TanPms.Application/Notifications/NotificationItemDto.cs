using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Notifications;

public sealed record NotificationItemDto(
    Guid Id,
    string Channel,
    string TemplateKey,
    LocalizedTextDto Title,
    LocalizedTextDto Body,
    bool IsRead,
    DateTimeOffset CreatedAt);
