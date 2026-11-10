using TanPms.Application.Common.Models;
namespace TanPms.Application.Notifications;

public sealed record NotificationListResponse(
    IReadOnlyList<NotificationItemDto> Items,
    PaginationMetadata? Pagination = null);
