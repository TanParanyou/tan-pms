using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;

namespace TanPms.Application.Notifications;

public sealed class DispatchAdminNotificationHandler
{
    private readonly IPmsOperationalStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly INotificationSender _notificationSender;

    public DispatchAdminNotificationHandler(
        IPmsOperationalStore store,
        ICurrentUserContext currentUser,
        INotificationSender notificationSender)
    {
        _store = store;
        _currentUser = currentUser;
        _notificationSender = notificationSender;
    }

    public Result<NotificationItemDto> Handle(DispatchAdminNotificationCommand command)
    {
        if (!_currentUser.IsAdminScope)
        {
            return Result<NotificationItemDto>.Failure(new Error(
                DomainErrorCodes.PermissionDenied,
                "Endpoint requires AdminScope authorization."));
        }

        if (!_currentUser.AllowedPropertyIds.Contains(command.PropertyId))
        {
            return Result<NotificationItemDto>.Failure(new Error(
                DomainErrorCodes.PropertyScopeDenied,
                $"Caller does not have access to property '{command.PropertyId}'."));
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
