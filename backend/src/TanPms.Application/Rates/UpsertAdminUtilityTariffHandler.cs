using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;

namespace TanPms.Application.Rates;

public sealed class UpsertAdminUtilityTariffHandler
{
    private readonly IPmsOperationalStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public UpsertAdminUtilityTariffHandler(
        IPmsOperationalStore store,
        ICurrentUserContext currentUser,
        IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<UtilityTariffItemDto> Handle(UpsertAdminUtilityTariffCommand command)
    {
        if (!_currentUser.IsAdminScope || !_currentUser.Permissions.Contains(PermissionKeys.AdminRatesManage))
        {
            return Result<UtilityTariffItemDto>.Failure(new Error(
                DomainErrorCodes.PermissionDenied,
                $"Caller lacks required permission '{PermissionKeys.AdminRatesManage}'."));
        }

        if (!_currentUser.AllowedPropertyIds.Contains(command.PropertyId))
        {
            return Result<UtilityTariffItemDto>.Failure(new Error(
                DomainErrorCodes.PropertyScopeDenied,
                $"Caller does not have access to property '{command.PropertyId}'."));
        }

        var result = _store.UpsertUtilityTariff(command.PropertyId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordAsync(new AuditEvent
            {
                PropertyId = command.PropertyId,
                ActionKey = PermissionKeys.AdminRatesManage,
                EntityId = result.Value.Id,
                Reason = $"Updated utility tariff {result.Value.UtilityType} ({result.Value.BillingMode})",
                AfterStateJson = $"{{\"utilityType\":\"{result.Value.UtilityType}\",\"billingMode\":\"{result.Value.BillingMode}\",\"ratePerUnit\":{result.Value.RatePerUnit}}}"
            }).GetAwaiter().GetResult();
        }

        return result;
    }
}
