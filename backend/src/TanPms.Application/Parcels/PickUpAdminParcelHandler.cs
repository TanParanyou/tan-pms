using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Parcels;

public sealed class PickUpAdminParcelHandler
{
    private readonly IParcelStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public PickUpAdminParcelHandler(IParcelStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<ParcelItemDto> Handle(PickUpAdminParcelCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminParcelsManage) is { } authError)
        {
            return Result<ParcelItemDto>.Failure(authError);
        }

        var result = _store.PickUpAdminParcel(command.PropertyId, command.ParcelId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminParcelsManage,
                entityId: result.Value.Id,
                reason: $"Parcel {result.Value.DocumentNumber} picked up",
                afterState: new { result.Value.Status, result.Value.PickedUpAt, result.Value.RecipientName });
        }

        return result;
    }
}
