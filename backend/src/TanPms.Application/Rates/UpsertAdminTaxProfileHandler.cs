using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;

namespace TanPms.Application.Rates;

public sealed class UpsertAdminTaxProfileHandler
{
    private readonly IPmsOperationalStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public UpsertAdminTaxProfileHandler(
        IPmsOperationalStore store,
        ICurrentUserContext currentUser,
        IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<TaxProfileItemDto> Handle(UpsertAdminTaxProfileCommand command)
    {
        if (!_currentUser.IsAdminScope || !_currentUser.Permissions.Contains(PermissionKeys.AdminRatesManage))
        {
            return Result<TaxProfileItemDto>.Failure(new Error(
                DomainErrorCodes.PermissionDenied,
                $"Caller lacks required permission '{PermissionKeys.AdminRatesManage}'."));
        }

        if (!_currentUser.AllowedPropertyIds.Contains(command.PropertyId))
        {
            return Result<TaxProfileItemDto>.Failure(new Error(
                DomainErrorCodes.PropertyScopeDenied,
                $"Caller does not have access to property '{command.PropertyId}'."));
        }

        var result = _store.UpsertTaxProfile(command.PropertyId, command.Request);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordAsync(new AuditEvent
            {
                PropertyId = command.PropertyId,
                ActionKey = PermissionKeys.AdminRatesManage,
                EntityId = result.Value.Id,
                Reason = $"Upserted tax profile {result.Value.ChargeCategoryCode} ({result.Value.TaxMode})",
                AfterStateJson = $"{{\"chargeCategoryCode\":\"{result.Value.ChargeCategoryCode}\",\"taxMode\":\"{result.Value.TaxMode}\",\"vatRatePercent\":{result.Value.VatRatePercent}}}"
            }).GetAwaiter().GetResult();
        }

        return result;
    }
}
