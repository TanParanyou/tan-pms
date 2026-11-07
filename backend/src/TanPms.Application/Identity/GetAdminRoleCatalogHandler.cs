using TanPms.Application.Common.Abstractions;
using TanPms.Application.Common.Results;
using TanPms.Application.Common.Security;

namespace TanPms.Application.Identity;

public sealed class GetAdminRoleCatalogHandler
{
    private readonly IIdentityStore _store;
    private readonly ICurrentUserContext _currentUser;

    public GetAdminRoleCatalogHandler(IIdentityStore store, ICurrentUserContext currentUser)
    {
        _store = store;
        _currentUser = currentUser;
    }

    public Result<RoleCatalogResponse> Handle(GetAdminRoleCatalogQuery _)
    {
        if (ScopeAuthorizationGuard.CheckAdminScope(_currentUser) is { } authError)
        {
            return Result<RoleCatalogResponse>.Failure(authError);
        }

        return _store.GetRoleCatalog();
    }
}
