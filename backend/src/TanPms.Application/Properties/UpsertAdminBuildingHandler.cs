using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Properties;

public sealed class UpsertAdminBuildingHandler
{
    private readonly IPropertyCatalogStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public UpsertAdminBuildingHandler(IPropertyCatalogStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<BuildingDetailDto> Handle(UpsertAdminBuildingCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminPropertiesManage) is { } authError)
        {
            return Result<BuildingDetailDto>.Failure(authError);
        }

        var result = _store.UpsertBuilding(command.PropertyId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminPropertiesManage,
                entityId: result.Value.Id,
                reason: command.Request.Id.HasValue ? $"Updated building {result.Value.Code}" : $"Created building {result.Value.Code}",
                afterState: new { result.Value.Code, Name = result.Value.Name });
        }

        return result;
    }
}
