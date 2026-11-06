using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;

namespace TanPms.Application.Notifications;

public sealed class GetClientNotificationsHandler
{
    private readonly IPmsOperationalStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetClientNotificationsHandler(IPmsOperationalStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<NotificationListResponse> Handle(GetClientNotificationsQuery _)
    {
        if (!_currentUser.IsClientScope || _currentUser.CustomerId is null || _currentUser.CustomerId == Guid.Empty)
        {
            return Result<NotificationListResponse>.Failure(new Error(
                DomainErrorCodes.PermissionDenied,
                "Endpoint requires ClientScope with a bound CustomerId."));
        }

        return _store.GetClientNotifications(_currentUser.CustomerId.Value);
    }
}
