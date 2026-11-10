using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Rates;

public sealed class DeleteAdminUtilityTariffHandler
{
    private readonly IRateCatalogStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public DeleteAdminUtilityTariffHandler(IRateCatalogStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<UtilityTariffItemDto> Handle(DeleteAdminUtilityTariffCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminRatesManage) is { } authError)
        {
            return Result<UtilityTariffItemDto>.Failure(authError);
        }

        var result = _store.DeleteUtilityTariff(command.PropertyId, command.TariffId);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminRatesManage,
                entityId: result.Value.Id,
                reason: $"Deleted {result.Value.UtilityType} tariff",
                afterState: new { result.Value.UtilityType, Deleted = true });
        }

        return result;
    }
}
