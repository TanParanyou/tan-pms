using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;
using TanPms.Domain.Identity;

namespace TanPms.Application.Properties;

public sealed class GetAdminPropertyHierarchyHandler
{
    private readonly IPropertyCatalogStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminPropertyHierarchyHandler(IPropertyCatalogStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<PropertyHierarchyResponse> Handle(GetAdminPropertyHierarchyQuery query)
    {
        if (ScopeAuthorizationGuard.CheckAdminPropertyScope(
            _currentUser,
            query.PropertyId,
            PermissionKeys.AdminPropertiesRead) is { } authError)
        {
            return Result<PropertyHierarchyResponse>.Failure(authError);
        }

        return _store.GetPropertyHierarchy(query.PropertyId);
    }
}
