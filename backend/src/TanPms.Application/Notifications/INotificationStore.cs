using TanPms.Application.Common.Results;

namespace TanPms.Application.Notifications;

public interface INotificationStore
{
    Result<NotificationItemDto> DispatchNotification(DispatchAdminNotificationCommand command);
    Result<NotificationListResponse> GetClientNotifications(Guid customerId);
}
