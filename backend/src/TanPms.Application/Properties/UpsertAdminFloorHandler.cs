using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Properties;

public sealed class UpsertAdminFloorHandler
{
    private readonly IPropertyCatalogStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public UpsertAdminFloorHandler(IPropertyCatalogStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<FloorDetailDto> Handle(UpsertAdminFloorCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminPropertiesManage) is { } authError)
        {
            return Result<FloorDetailDto>.Failure(authError);
        }

        var result = _store.UpsertFloor(command.PropertyId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminPropertiesManage,
                entityId: result.Value.Id,
                reason: command.Request.Id.HasValue ? $"Updated floor {result.Value.FloorNumber}" : $"Created floor {result.Value.FloorNumber}",
                afterState: new { result.Value.FloorNumber, Name = result.Value.Name });
        }

        return result;
    }
}
