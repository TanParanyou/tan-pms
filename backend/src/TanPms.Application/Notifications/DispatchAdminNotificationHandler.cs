using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;

namespace TanPms.Application.Notifications;

public sealed class DispatchAdminNotificationHandler
{
    private readonly INotificationStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly INotificationSender _notificationSender;

    public DispatchAdminNotificationHandler(
        INotificationStore store,
        ICurrentUserContext currentUser,
        INotificationSender notificationSender)
    {
        _store = store;
        _currentUser = currentUser;
        _notificationSender = notificationSender;
    }

    public Result<NotificationItemDto> Handle(DispatchAdminNotificationCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyAccess(_currentUser, command.PropertyId) is { } authError)
        {
            return Result<NotificationItemDto>.Failure(authError);
        }

        var result = _store.DispatchNotification(command);
        if (result.IsSuccess && result.Value is not null)
        {
            _notificationSender.NotifyCustomerAsync(
                command.CustomerId,
                command.TemplateKey,
                new Dictionary<string, string>
                {
                    ["channel"] = command.Channel,
                    ["title_th"] = command.Title.Th
                }).GetAwaiter().GetResult();
        }

        return result;
    }
}
