using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Parcels;

public sealed class ReceiveAdminParcelHandler
{
    private readonly IParcelStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;
    private readonly INotificationSender _notificationSender;

    public ReceiveAdminParcelHandler(
        IParcelStore store,
        ICurrentUserContext currentUser,
        IAuditLogger auditLogger,
        INotificationSender notificationSender)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
        _notificationSender = notificationSender;
    }

    public Result<ParcelItemDto> Handle(ReceiveAdminParcelCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminParcelsManage) is { } authError)
        {
            return Result<ParcelItemDto>.Failure(authError);
        }

        var result = _store.ReceiveAdminParcel(command.PropertyId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminParcelsManage,
                entityId: result.Value.Id,
                reason: $"Received parcel {result.Value.DocumentNumber} for unit {result.Value.Unit.UnitNumber}",
                afterState: new { result.Value.DocumentNumber, result.Value.Status, result.Value.CarrierName });

            _notificationSender.NotifyCustomerAsync(
                result.Value.Customer.Id,
                ParcelRules.ArrivedTemplateKey,
                new Dictionary<string, string>
                {
                    ["channel"] = "InApp",
                    ["document_number"] = result.Value.DocumentNumber
                }).GetAwaiter().GetResult();
        }

        return result;
    }
}
