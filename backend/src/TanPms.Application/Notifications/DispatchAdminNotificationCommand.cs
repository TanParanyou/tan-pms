using TanPms.Application.Common.Contracts;

namespace TanPms.Application.Notifications;

public sealed record DispatchAdminNotificationCommand(
    Guid PropertyId,
    Guid CustomerId,
    string Channel,
    string TemplateKey,
    LocalizedTextDto Title,
    LocalizedTextDto Body);
