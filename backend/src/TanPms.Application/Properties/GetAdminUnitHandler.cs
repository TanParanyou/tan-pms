using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Properties;

public sealed class GetAdminUnitHandler
{
    private readonly IPropertyCatalogStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminUnitHandler(IPropertyCatalogStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<UnitMasterItemDto> Handle(GetAdminUnitQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScopeAnyPermission(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminPropertiesRead,
            PermissionKeys.AdminPropertiesManage) is { } authError)
        {
            return Result<UnitMasterItemDto>.Failure(authError);
        }

        return _store.GetUnitMaster(query.PropertyId, query.UnitId);
    }
}
