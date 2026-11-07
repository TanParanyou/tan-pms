using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Rates;

public sealed class UpsertAdminUtilityTariffHandler
{
    private readonly IRateCatalogStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public UpsertAdminUtilityTariffHandler(
        IRateCatalogStore store,
        ICurrentUserContext currentUser,
        IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<UtilityTariffItemDto> Handle(UpsertAdminUtilityTariffCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminRatesManage) is { } authError)
        {
            return Result<UtilityTariffItemDto>.Failure(authError);
        }

        var result = _store.UpsertUtilityTariff(command.PropertyId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminRatesManage,
                entityId: result.Value.Id,
                reason: $"Updated utility tariff {result.Value.UtilityType} ({result.Value.BillingMode})",
                afterState: new
                {
                    result.Value.UtilityType,
                    result.Value.BillingMode,
                    result.Value.RatePerUnit
                });
        }

        return result;
    }
}
