using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;

namespace TanPms.Application.Properties;

public sealed class UpsertAdminUnitMasterHandler
{
    private readonly IPropertyCatalogStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public UpsertAdminUnitMasterHandler(
        IPropertyCatalogStore store,
        ICurrentUserContext currentUser,
        IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<UnitMasterItemDto> Handle(UpsertAdminUnitMasterCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminPropertiesManage) is { } authError)
        {
            return Result<UnitMasterItemDto>.Failure(authError);
        }

        if (string.IsNullOrWhiteSpace(command.Request.UnitNumber))
        {
            return Result<UnitMasterItemDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                "UnitNumber cannot be empty."));
        }

        if (command.Request.SupportedStayModes == null || command.Request.SupportedStayModes.Count == 0)
        {
            return Result<UnitMasterItemDto>.Failure(new Error(
                DomainErrorCodes.ValidationFailed,
                "Unit must support at least one StayMode."));
        }

        var result = _store.UpsertUnitMaster(command.PropertyId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminPropertiesManage,
                entityId: result.Value.Id,
                reason: $"Upserted unit {result.Value.UnitNumber}",
                afterState: new
                {
                    result.Value.UnitNumber,
                    result.Value.ConditionStatus,
                    AssetsCount = result.Value.Assets.Count
                });
        }

        return result;
    }
}
