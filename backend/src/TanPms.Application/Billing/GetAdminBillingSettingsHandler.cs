using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Billing;

public sealed class GetAdminBillingSettingsHandler
{
    private readonly IBillingStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminBillingSettingsHandler(IBillingStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<BillingSettingsDto> Handle(GetAdminBillingSettingsQuery query)
    {
        return ScopeAuthorizationGuard.CheckAdminPropertyScopeAnyPermission(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminPropertiesManage,
            PermissionKeys.AdminPropertiesRead,
            PermissionKeys.AdminBillingIssueBatch) is { } authError
            ? Result<BillingSettingsDto>.Failure(authError)
            : _store.GetBillingSettings(query.PropertyId);
    }
}
