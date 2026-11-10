using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Rates;

public sealed class DeleteAdminTaxProfileHandler
{
    private readonly IRateCatalogStore _store;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditLogger _auditLogger;

    public DeleteAdminTaxProfileHandler(IRateCatalogStore store, ICurrentUserContext currentUser, IAuditLogger auditLogger)
    {
        _store = store;
        _currentUser = currentUser;
        _auditLogger = auditLogger;
    }

    public Result<TaxProfileItemDto> Handle(DeleteAdminTaxProfileCommand command)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            command.PropertyId,
            PermissionKeys.AdminRatesManage) is { } authError)
        {
            return Result<TaxProfileItemDto>.Failure(authError);
        }

        var result = _store.DeleteTaxProfile(command.PropertyId, command.TaxProfileId);
        if (result.IsSuccess && result.Value is not null)
        {
            _auditLogger.RecordMutation(
                propertyId: command.PropertyId,
                actionKey: PermissionKeys.AdminRatesManage,
                entityId: result.Value.Id,
                reason: $"Deleted tax profile {result.Value.ChargeCategoryCode}",
                afterState: new { result.Value.ChargeCategoryCode, Deleted = true });
        }

        return result;
    }
}
