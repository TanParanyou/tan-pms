namespace TanPms.Application.Notifications;

public sealed record GetClientNotificationsQuery(
    int? Page = null,
    int? PageSize = null);
