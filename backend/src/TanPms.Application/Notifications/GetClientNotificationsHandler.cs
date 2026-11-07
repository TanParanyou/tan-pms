using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;

namespace TanPms.Application.Notifications;

public sealed class GetClientNotificationsHandler
{
    private readonly INotificationStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetClientNotificationsHandler(INotificationStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<NotificationListResponse> Handle(GetClientNotificationsQuery _)
    {
        if (ScopeAuthorizationGuard.CheckClientScope(_currentUser, out var customerId) is { } authError)
        {
            return Result<NotificationListResponse>.Failure(authError);
        }

        return _store.GetClientNotifications(customerId);
    }
}
