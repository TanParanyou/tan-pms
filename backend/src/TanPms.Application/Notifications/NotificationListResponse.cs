namespace TanPms.Application.Notifications;

public sealed record NotificationListResponse(
    IReadOnlyList<NotificationItemDto> Items);
