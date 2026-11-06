using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Domain.Common;
using TanPms.Domain.Identity;

namespace TanPms.Application.Rates;

public sealed class GetAdminPropertyRateCatalogHandler
{
    private readonly IPmsOperationalStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminPropertyRateCatalogHandler(
        IPmsOperationalStore store,
        ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<PropertyRateCatalogResponse> Handle(GetAdminPropertyRateCatalogQuery query)
    {
        var hasReadAccess = _currentUser.Permissions.Contains(PermissionKeys.AdminRatesManage)
            || _currentUser.Permissions.Contains(PermissionKeys.AdminPropertiesRead);

        if (!_currentUser.IsAdminScope || !hasReadAccess)
        {
            return Result<PropertyRateCatalogResponse>.Failure(new Error(
                DomainErrorCodes.PermissionDenied,
                $"Caller lacks required permission '{PermissionKeys.AdminRatesManage}' or '{PermissionKeys.AdminPropertiesRead}'."));
        }

        if (!_currentUser.AllowedPropertyIds.Contains(query.PropertyId))
        {
            return Result<PropertyRateCatalogResponse>.Failure(new Error(
                DomainErrorCodes.PropertyScopeDenied,
                $"Caller does not have access to property '{query.PropertyId}'."));
        }

        return _store.GetPropertyRateCatalog(query.PropertyId);
    }
}
