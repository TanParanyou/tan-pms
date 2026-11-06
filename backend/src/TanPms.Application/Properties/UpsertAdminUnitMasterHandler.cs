using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;

namespace TanPms.Application.Properties;

public sealed class UpsertAdminUnitMasterHandler
{
    private readonly IPmsOperationalStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public UpsertAdminUnitMasterHandler(
        IPmsOperationalStore store,
        ICurrentUserContext currentUser,
        IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<UnitMasterItemDto> Handle(UpsertAdminUnitMasterCommand command)
    {
        if (!_currentUser.IsAdminScope || !_currentUser.Permissions.Contains(PermissionKeys.AdminPropertiesManage))
        {
            return Result<UnitMasterItemDto>.Failure(new Error(
                DomainErrorCodes.PermissionDenied,
                $"Caller lacks required permission '{PermissionKeys.AdminPropertiesManage}'."));
        }

        if (!_currentUser.AllowedPropertyIds.Contains(command.PropertyId))
        {
            return Result<UnitMasterItemDto>.Failure(new Error(
                DomainErrorCodes.PropertyScopeDenied,
                $"Caller does not have access to property '{command.PropertyId}'."));
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
            _auditLogger.RecordAsync(new AuditEvent
            {
                PropertyId = command.PropertyId,
                ActionKey = PermissionKeys.AdminPropertiesManage,
                EntityId = result.Value.Id,
                Reason = $"Upserted unit {result.Value.UnitNumber}",
                AfterStateJson = $"{{\"unitNumber\":\"{result.Value.UnitNumber}\",\"conditionStatus\":\"{result.Value.ConditionStatus}\",\"assetsCount\":{result.Value.Assets.Count}}}"
            }).GetAwaiter().GetResult();
        }

        return result;
    }
}
