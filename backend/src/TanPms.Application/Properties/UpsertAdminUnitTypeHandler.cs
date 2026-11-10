using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Properties;

public sealed class UpsertAdminUnitTypeHandler
{
    private readonly IPropertyCatalogStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public UpsertAdminUnitTypeHandler(IPropertyCatalogStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<UnitTypeDetailDto> Handle(UpsertAdminUnitTypeCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminPropertiesManage) is { } authError)
        {
            return Result<UnitTypeDetailDto>.Failure(authError);
        }

        var result = _store.UpsertUnitType(command.PropertyId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminPropertiesManage,
                entityId: result.Value.Id,
                reason: command.Request.Id.HasValue ? $"Updated unit type {result.Value.Code}" : $"Created unit type {result.Value.Code}",
                afterState: new { result.Value.Code, Name = result.Value.Name });
        }

        return result;
    }
}
