using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Rates;

public sealed class GetAdminPropertyRateCatalogHandler
{
    private readonly IRateCatalogStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminPropertyRateCatalogHandler(
        IRateCatalogStore store,
        ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<PropertyRateCatalogResponse> Handle(GetAdminPropertyRateCatalogQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScopeAnyPermission(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminRatesManage,
            PermissionKeys.AdminPropertiesRead) is { } authError)
        {
            return Result<PropertyRateCatalogResponse>.Failure(authError);
        }

        return _store.GetPropertyRateCatalog(query.PropertyId);
    }
}
